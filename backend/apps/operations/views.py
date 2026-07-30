import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection, transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserInvitation, UserProfile
from apps.accounts.permissions import IsAdminRole
from apps.audit.models import AuditLog
from apps.employees.models import Employee, EmployeeImportJob
from apps.reminders.models import Reminder
from apps.tickets.models import Ticket
from apps.common.pagination import StandardResultsPagination


def _status_from_checks(*statuses):
    if "critical" in statuses:
        return "critical"
    if "warning" in statuses:
        return "warning"
    return "healthy"


def _safe_int(value):
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_basename(value):
    if not value:
        return None

    return str(value).replace("\\", "/").rstrip("/").split("/")[-1] or None


def _read_latest_backup_manifest(now):
    manifest_dir = Path(getattr(settings, "BACKUP_MANIFEST_DIR"))
    warnings = []

    if not manifest_dir.exists():
        return {
            "status": "unknown",
            "latest_manifest": None,
            "manifest_count": 0,
            "warnings": ["Henüz backup manifesti bulunamadı."],
        }

    manifests = sorted(
        manifest_dir.glob("backup-manifest-*.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )

    if not manifests:
        return {
            "status": "unknown",
            "latest_manifest": None,
            "manifest_count": 0,
            "warnings": ["Henüz backup manifesti bulunamadı."],
        }

    latest = manifests[0]
    try:
        data = json.loads(latest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "status": "critical",
            "latest_manifest": None,
            "manifest_count": len(manifests),
            "warnings": ["Son backup manifesti okunamadı."],
        }

    finished_at_raw = data.get("finished_at")
    age_hours = None
    try:
        finished_at = timezone.datetime.fromisoformat(
            str(finished_at_raw).replace("Z", "+00:00")
        )
        age_hours = round((now - finished_at).total_seconds() / 3600, 1)
    except (TypeError, ValueError):
        warnings.append("Son backup bitiş zamanı okunamadı.")

    manifest_status = data.get("status")
    if manifest_status != "success":
        status = "critical" if manifest_status == "failed" else "warning"
        warnings.append("Son backup sağlıklı değil. Verify script'i çalıştırın.")
    elif age_hours is not None and age_hours > 72:
        status = "critical"
        warnings.append("Son backup 72 saatten eski görünüyor.")
    elif age_hours is not None and age_hours > 24:
        status = "warning"
        warnings.append("Son backup 24 saatten eski görünüyor.")
    else:
        status = "healthy"

    latest_manifest = {
        "run_id": data.get("run_id"),
        "started_at": data.get("started_at"),
        "finished_at": finished_at_raw,
        "status": manifest_status,
        "environment": data.get("environment"),
        "postgres_backup_file": _safe_basename(data.get("postgres_backup_path")),
        "postgres_backup_size_bytes": _safe_int(
            data.get("postgres_backup_size_bytes")
        ),
        "media_backup_file": _safe_basename(data.get("media_backup_path")),
        "media_backup_size_bytes": _safe_int(data.get("media_backup_size_bytes")),
        "retention_applied": bool(data.get("retention_applied")),
        "deleted_files_count": _safe_int(data.get("deleted_files_count")) or 0,
        "warnings_count": len(data.get("warnings") or []),
        "errors_count": len(data.get("errors") or []),
        "age_hours": age_hours,
    }

    return {
        "status": status,
        "latest_manifest": latest_manifest,
        "manifest_count": len(manifests),
        "warnings": warnings,
    }


def _database_status():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return "error"

    return "ok"


def _cache_status():
    cache_backend = settings.CACHES.get("default", {}).get("BACKEND", "")
    if "LocMemCache" in cache_backend:
        configured_status = "local_memory"
    elif "RedisCache" in cache_backend:
        configured_status = "redis"
    else:
        configured_status = "configured"

    try:
        cache.set("admin-console-health", "ok", timeout=10)
        if cache.get("admin-console-health") != "ok":
            return "error"
    except Exception:
        return "error"

    return "ok" if configured_status != "local_memory" else "not_configured"


def _accounts_summary(now):
    User = get_user_model()
    thirty_days_ago = now - timezone.timedelta(days=30)

    pending = UserInvitation.objects.filter(status=UserInvitation.Status.PENDING)
    users_with_employee = User.objects.filter(employee_profile__isnull=False).count()
    activation_needed_users = sum(
        1
        for user in User.objects.select_related("employee_profile")
        if getattr(user, "employee_profile", None)
        and (not user.is_active or not user.has_usable_password())
    )

    return {
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
        "inactive_users": User.objects.filter(is_active=False).count(),
        "users_without_usable_credential": sum(
            1 for user in User.objects.only("id", "password") if not user.has_usable_password()
        ),
        "pending_invitations": pending.filter(expires_at__gte=now).count(),
        "expired_invitations": pending.filter(expires_at__lt=now).count()
        + UserInvitation.objects.filter(status=UserInvitation.Status.EXPIRED).count(),
        "activation_needed_users": activation_needed_users,
        "users_with_employee": users_with_employee,
        "users_without_employee": User.objects.count() - users_with_employee,
        "accepted_invitations_30d": UserInvitation.objects.filter(
            status=UserInvitation.Status.ACCEPTED,
            accepted_at__gte=thirty_days_ago,
        ).count(),
        "revoked_invitations_30d": UserInvitation.objects.filter(
            status=UserInvitation.Status.REVOKED,
            revoked_at__gte=thirty_days_ago,
        ).count(),
    }


def _employees_summary():
    latest_import = (
        EmployeeImportJob.objects.order_by("-created_at")
        .values(
            "id",
            "status",
            "created_at",
            "committed_at",
            "created_count",
            "error_rows",
            "warning_rows",
        )
        .first()
    )

    if latest_import:
        latest_import = {
            "id": latest_import["id"],
            "status": latest_import["status"],
            "created_at": latest_import["created_at"],
            "committed_at": latest_import["committed_at"],
            "created_count": latest_import["created_count"],
            "error_count": latest_import["error_rows"],
            "warning_count": latest_import["warning_rows"],
        }

    return {
        "total_employees": Employee.objects.count(),
        "active_employees": Employee.objects.filter(is_active=True).count(),
        "employees_with_user": Employee.objects.filter(user__isnull=False).count(),
        "employees_without_user": Employee.objects.filter(user__isnull=True).count(),
        "inactive_linked_users": Employee.objects.filter(
            user__isnull=False,
            user__is_active=False,
        ).count(),
        "latest_import": latest_import,
    }


def _operations_summary(now):
    since = now - timezone.timedelta(hours=24)
    open_statuses = [
        Ticket.Status.OPEN,
        Ticket.Status.IN_PROGRESS,
        Ticket.Status.RETURNED_TO_REQUESTER,
    ]

    return {
        "open_critical_items": [],
        "audit_logs_24h": AuditLog.objects.filter(created_at__gte=since).count(),
        "critical_audit_logs_24h": AuditLog.objects.filter(
            created_at__gte=since,
            action__in=[
                AuditLog.Action.DELETE,
                AuditLog.Action.RESTORE,
                AuditLog.Action.DISPOSE,
            ],
        ).count(),
        "open_tickets": Ticket.objects.filter(status__in=open_statuses).count(),
        "urgent_tickets": Ticket.objects.filter(
            status__in=open_statuses,
            priority=Ticket.Priority.URGENT,
        ).count(),
        "overdue_reminders": Reminder.objects.filter(
            status=Reminder.Status.PENDING,
            due_date__lt=timezone.localdate(),
        ).count(),
    }


def _mask_email(email):
    if not email or "@" not in email:
        return None

    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = f"{local[:1]}***"
    else:
        masked_local = f"{local[:2]}***"

    return f"{masked_local}@{domain}"


def _latest_invitation(user):
    invitations = list(getattr(user, "admin_console_invitations", []))
    if invitations:
        return invitations[0]

    return (
        UserInvitation.objects.filter(user=user)
        .order_by("-created_at")
        .first()
    )


def _invitation_counts(user, now):
    invitations = list(getattr(user, "admin_console_invitations", []))
    if not invitations:
        invitations = list(UserInvitation.objects.filter(user=user))

    pending = [
        invitation
        for invitation in invitations
        if invitation.status == UserInvitation.Status.PENDING
        and invitation.expires_at >= now
    ]
    expired = [
        invitation
        for invitation in invitations
        if (
            invitation.status == UserInvitation.Status.PENDING
            and invitation.expires_at < now
        )
        or invitation.status == UserInvitation.Status.EXPIRED
    ]

    return {
        "pending": len(pending),
        "expired": len(expired),
        "accepted_30d": len(
            [
                invitation
                for invitation in invitations
                if invitation.status == UserInvitation.Status.ACCEPTED
                and invitation.accepted_at
                and invitation.accepted_at >= now - timezone.timedelta(days=30)
            ]
        ),
        "revoked_30d": len(
            [
                invitation
                for invitation in invitations
                if invitation.status == UserInvitation.Status.REVOKED
                and invitation.revoked_at
                and invitation.revoked_at >= now - timezone.timedelta(days=30)
            ]
        ),
    }


def _activation_state(user, latest_invitation, counts):
    employee = getattr(user, "employee_profile", None)
    if not employee:
        return "no_employee"

    if user.is_active and user.has_usable_password():
        return "active"

    if counts["pending"] > 0:
        return "pending_invitation"

    if counts["expired"] > 0:
        return "expired_invitation"

    if not user.is_active or not user.has_usable_password():
        return "needs_activation"

    if latest_invitation:
        return latest_invitation.status

    return "active"


def _employee_summary(user):
    employee = getattr(user, "employee_profile", None)
    if not employee:
        return None

    return {
        "id": employee.id,
        "full_name": employee.full_name,
        "employee_code": employee.employee_code,
        "department_name": employee.department.name if employee.department else None,
        "job_title_name": employee.job_title.name if employee.job_title else None,
        "is_active": employee.is_active,
    }


def _serialize_admin_user(user, now, include_detail=False):
    latest = _latest_invitation(user)
    counts = _invitation_counts(user, now)
    activation_state = _activation_state(user, latest, counts)
    profile = getattr(user, "profile", None)
    display_name = user.get_full_name() or user.username

    data = {
        "id": user.id,
        "username": user.username,
        "display_name": display_name,
        "masked_email": _mask_email(user.email),
        "role": profile.role if profile else None,
        "is_active": user.is_active,
        "has_usable_credential": user.has_usable_password(),
        "last_login": user.last_login,
        "date_joined": user.date_joined,
        "employee": _employee_summary(user),
        "activation": {
            "state": activation_state,
            "needs_invitation": activation_state
            in ["needs_activation", "expired_invitation"],
            "latest_invitation_id": latest.id if latest else None,
            "latest_invitation_status": latest.status if latest else None,
            "latest_invitation_expires_at": latest.expires_at if latest else None,
            "latest_invitation_created_at": latest.created_at if latest else None,
            "pending_invitation_count": counts["pending"],
            "expired_invitation_count": counts["expired"],
            "accepted_invitations_30d": counts["accepted_30d"],
            "revoked_invitations_30d": counts["revoked_30d"],
        },
    }

    if include_detail:
        audit_since = now - timezone.timedelta(days=30)
        data["audit"] = {
            "audit_logs_30d": AuditLog.objects.filter(
                actor=user,
                created_at__gte=audit_since,
            ).count()
        }
        data["recommended_next_step"] = _recommended_user_next_step(
            data["activation"]["state"],
            data["employee"],
        )

    return data


def _recommended_user_next_step(activation_state, employee):
    if employee is None:
        return "Bu kullanıcı personel kaydıyla bağlı değil. Personel sayfasında eşleştirme durumunu kontrol edin."

    if activation_state in ["needs_activation", "expired_invitation"]:
        return "Davet linki oluşturmak için Personel detayına gidin."

    if activation_state == "pending_invitation":
        return "Bekleyen davet durumunu Personel detayından takip edin."

    return "Kullanıcı aktif görünüyor."


def _admin_user_queryset():
    User = get_user_model()
    return (
        User.objects.select_related(
            "profile",
            "employee_profile",
            "employee_profile__department",
            "employee_profile__job_title",
        )
        .prefetch_related(
            Prefetch(
                "invitations",
                queryset=UserInvitation.objects.order_by("-created_at"),
                to_attr="admin_console_invitations",
            )
        )
        .order_by("username", "id")
    )


def _filter_users(queryset, params):
    search = (params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(username__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(employee_profile__full_name__icontains=search)
            | Q(employee_profile__employee_code__icontains=search)
        )

    role = params.get("role")
    if role:
        queryset = queryset.filter(profile__role=role)

    is_active = params.get("is_active")
    if is_active in ["true", "false"]:
        queryset = queryset.filter(is_active=is_active == "true")

    has_employee = params.get("has_employee")
    if has_employee == "true":
        queryset = queryset.filter(employee_profile__isnull=False)
    elif has_employee == "false":
        queryset = queryset.filter(employee_profile__isnull=True)

    has_usable_password = params.get("has_usable_password")
    if has_usable_password in ["true", "false"]:
        wanted = has_usable_password == "true"
        ids = [
            user.id
            for user in queryset.only("id", "password")
            if user.has_usable_password() == wanted
        ]
        queryset = queryset.filter(id__in=ids)

    invitation_status = params.get("invitation_status")
    if invitation_status == "none":
        queryset = queryset.filter(invitations__isnull=True)
    elif invitation_status:
        queryset = queryset.filter(invitations__status=invitation_status)

    activation_state = params.get("activation_state")
    if activation_state:
        now = timezone.now()
        if activation_state == "active":
            ids = [
                user.id
                for user in queryset
                if user.is_active
                and user.has_usable_password()
                and getattr(user, "employee_profile", None)
            ]
        elif activation_state == "inactive":
            ids = [user.id for user in queryset if not user.is_active]
        elif activation_state == "needs_activation":
            ids = [
                user.id
                for user in queryset
                if (not user.is_active or not user.has_usable_password())
                and getattr(user, "employee_profile", None)
            ]
        elif activation_state == "pending_invitation":
            ids = [
                user.id
                for user in queryset
                if UserInvitation.objects.filter(
                    user=user,
                    status=UserInvitation.Status.PENDING,
                    expires_at__gte=now,
                ).exists()
            ]
        elif activation_state == "expired_invitation":
            ids = [
                user.id
                for user in queryset
                if UserInvitation.objects.filter(
                    Q(status=UserInvitation.Status.EXPIRED)
                    | Q(
                        status=UserInvitation.Status.PENDING,
                        expires_at__lt=now,
                    ),
                    user=user,
                ).exists()
            ]
        elif activation_state == "no_employee":
            ids = [
                user.id
                for user in queryset
                if not getattr(user, "employee_profile", None)
            ]
        else:
            ids = None

        if ids is not None:
            queryset = queryset.filter(id__in=ids)

    ordering_map = {
        "username": "username",
        "role": "profile__role",
        "is_active": "is_active",
        "last_login": "last_login",
        "date_joined": "date_joined",
        "employee_name": "employee_profile__full_name",
    }
    ordering = params.get("ordering") or "username"
    is_desc = ordering.startswith("-")
    ordering_key = ordering[1:] if is_desc else ordering
    field = ordering_map.get(ordering_key, "username")
    queryset = queryset.order_by(f"-{field}" if is_desc else field, "id").distinct()

    return queryset


def _expected_confirmation(action, username):
    return f"{action} {username}"


def _validate_user_action_payload(request, confirmation_action):
    reason = str(request.data.get("reason") or "").strip()
    confirmation = str(request.data.get("confirmation") or "").strip()
    expected = _expected_confirmation(confirmation_action, request.user_action_username)

    if len(reason) < 5:
        return None, Response(
            {"detail": "Gerekçe en az 5 karakter olmalıdır."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(reason) > 500:
        return None, Response(
            {"detail": "Gerekçe en fazla 500 karakter olabilir."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if confirmation != expected:
        return None, Response(
            {"detail": f"Onay metni tam olarak '{expected}' olmalıdır."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return reason, None


def _active_admin_count_locked():
    User = get_user_model()
    return (
        User.objects.select_for_update()
        .filter(is_active=True, profile__role=UserProfile.Role.ADMIN)
        .count()
    )


def _is_active_admin(user):
    profile = getattr(user, "profile", None)
    return bool(user.is_active and profile and profile.role == UserProfile.Role.ADMIN)


def _admin_action_response(detail, user):
    refreshed_user = _admin_user_queryset().get(pk=user.pk)
    return Response(
        {
            "detail": detail,
            "user": _serialize_admin_user(
                refreshed_user,
                timezone.now(),
                include_detail=True,
            ),
        }
    )


def _audit_admin_user_action(
    *,
    request,
    target_user,
    operation,
    reason,
    previous_is_active,
    new_is_active,
    previous_role,
    new_role,
    changes,
):
    AuditLog.objects.create(
        actor=request.user,
        action=AuditLog.Action.UPDATE,
        entity_type="accounts.User",
        entity_id=str(target_user.id),
        entity_repr=target_user.username,
        changes=changes,
        request_method=request.method,
        request_path=request.path,
        metadata={
            "operation": operation,
            "actor_user_id": request.user.id,
            "target_user_id": target_user.id,
            "target_username": target_user.username,
            "previous_is_active": previous_is_active,
            "new_is_active": new_is_active,
            "previous_role": previous_role,
            "new_role": new_role,
            "reason": reason,
            "source": "admin_console",
        },
    )


class AdminConsoleUserActionMixin:
    permission_classes = [IsAdminRole]
    confirmation_action = ""

    def get_locked_user(self, pk):
        User = get_user_model()
        user = User.objects.select_for_update().get(pk=pk)
        profile = UserProfile.objects.select_for_update().get(user=user)
        user._state.fields_cache["profile"] = profile
        return user


class AdminConsoleOverviewAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        database_status = _database_status()
        cache_status = _cache_status()
        backup = _read_latest_backup_manifest(now)
        security_warnings = []

        if settings.DEBUG:
            security_warnings.append("DEBUG açık.")

        system_status = _status_from_checks(
            "critical" if database_status == "error" else "healthy",
            "warning" if cache_status != "ok" else "healthy",
            "warning" if security_warnings else "healthy",
        )

        return Response(
            {
                "generated_at": now,
                "system": {
                    "status": system_status,
                    "environment": getattr(settings, "DJANGO_ENV", "unknown"),
                    "debug": settings.DEBUG,
                    "database": {"status": database_status},
                    "cache": {"status": cache_status},
                    "security": {
                        "refresh_cookie_secure": settings.REFRESH_TOKEN_COOKIE_SECURE,
                        "origin_required": settings.AUTH_COOKIE_REQUIRE_ORIGIN,
                        "warnings": security_warnings,
                    },
                },
                "backup": backup,
                "accounts": _accounts_summary(now),
                "employees": _employees_summary(),
                "operations": _operations_summary(now),
                "links": {
                    "audit": "/audit",
                    "personnel": "/personnel",
                    "reminders": "/reminders",
                    "tickets": "/tickets",
                    "backup_docs": "docs/operations/backup-restore.md",
                    "scheduled_jobs_docs": "docs/operations/scheduled-jobs.md",
                    "production_readiness_docs": "docs/operations/production-readiness.md",
                },
            }
        )


class AdminConsoleUserListAPIView(APIView):
    permission_classes = [IsAdminRole]
    pagination_class = StandardResultsPagination

    def get(self, request):
        now = timezone.now()
        queryset = _filter_users(_admin_user_queryset(), request.query_params)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        results = [_serialize_admin_user(user, now) for user in page]

        return paginator.get_paginated_response(results)


class AdminConsoleUserDetailAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        now = timezone.now()
        try:
            user = _admin_user_queryset().get(pk=pk)
        except get_user_model().DoesNotExist:
            return Response(
                {"detail": "Kullanıcı bulunamadı."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(_serialize_admin_user(user, now, include_detail=True))


class AdminConsoleUserDeactivateAPIView(AdminConsoleUserActionMixin, APIView):
    confirmation_action = "DEACTIVATE"

    def post(self, request, pk):
        User = get_user_model()
        with transaction.atomic():
            try:
                user = self.get_locked_user(pk)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Kullanıcı bulunamadı."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            request.user_action_username = user.username
            reason, error = _validate_user_action_payload(
                request,
                self.confirmation_action,
            )
            if error:
                return error

            if user.id == request.user.id:
                return Response(
                    {"detail": "Kendi hesabınızı pasifleştiremezsiniz."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.is_active:
                return Response(
                    {"detail": "Kullanıcı zaten pasif."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if _is_active_admin(user) and _active_admin_count_locked() <= 1:
                return Response(
                    {"detail": "Son aktif admin kullanıcısı değiştirilemez."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_is_active = user.is_active
            previous_role = user.profile.role
            user.is_active = False
            user.save(update_fields=["is_active"])
            _audit_admin_user_action(
                request=request,
                target_user=user,
                operation="admin_user_deactivate",
                reason=reason,
                previous_is_active=previous_is_active,
                new_is_active=user.is_active,
                previous_role=previous_role,
                new_role=previous_role,
                changes={"is_active": {"old": previous_is_active, "new": user.is_active}},
            )

        return _admin_action_response("Kullanıcı pasifleştirildi.", user)


class AdminConsoleUserReactivateAPIView(AdminConsoleUserActionMixin, APIView):
    confirmation_action = "REACTIVATE"

    def post(self, request, pk):
        User = get_user_model()
        with transaction.atomic():
            try:
                user = self.get_locked_user(pk)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Kullanıcı bulunamadı."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            request.user_action_username = user.username
            reason, error = _validate_user_action_payload(
                request,
                self.confirmation_action,
            )
            if error:
                return error

            if user.is_active:
                return Response(
                    {"detail": "Kullanıcı zaten aktif."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.has_usable_password():
                return Response(
                    {
                        "detail": "Bu kullanıcının kullanılabilir şifresi yok. Davet linki ile aktivasyon yapılmalı."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_is_active = user.is_active
            previous_role = user.profile.role
            user.is_active = True
            user.save(update_fields=["is_active"])
            _audit_admin_user_action(
                request=request,
                target_user=user,
                operation="admin_user_reactivate",
                reason=reason,
                previous_is_active=previous_is_active,
                new_is_active=user.is_active,
                previous_role=previous_role,
                new_role=previous_role,
                changes={"is_active": {"old": previous_is_active, "new": user.is_active}},
            )

        return _admin_action_response("Kullanıcı yeniden aktifleştirildi.", user)


class AdminConsoleUserChangeRoleAPIView(AdminConsoleUserActionMixin, APIView):
    confirmation_action = "CHANGE ROLE"

    def post(self, request, pk):
        User = get_user_model()
        new_role = str(request.data.get("role") or "").strip()
        valid_roles = {role for role, _label in UserProfile.Role.choices}
        if new_role not in valid_roles:
            return Response(
                {"detail": "Geçersiz rol."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            try:
                user = self.get_locked_user(pk)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Kullanıcı bulunamadı."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            request.user_action_username = user.username
            reason, error = _validate_user_action_payload(
                request,
                self.confirmation_action,
            )
            if error:
                return error

            if user.id == request.user.id:
                return Response(
                    {"detail": "Kendi rolünüzü değiştiremezsiniz."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_role = user.profile.role
            if previous_role == new_role:
                return Response(
                    {"detail": "Kullanıcı zaten bu rolde."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                user.is_active
                and previous_role == UserProfile.Role.ADMIN
                and new_role != UserProfile.Role.ADMIN
                and _active_admin_count_locked() <= 1
            ):
                return Response(
                    {"detail": "Son aktif admin kullanıcısı değiştirilemez."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_is_active = user.is_active
            user.profile.role = new_role
            user.profile.save(update_fields=["role"])
            _audit_admin_user_action(
                request=request,
                target_user=user,
                operation="admin_user_role_change",
                reason=reason,
                previous_is_active=previous_is_active,
                new_is_active=previous_is_active,
                previous_role=previous_role,
                new_role=new_role,
                changes={"role": {"old": previous_role, "new": new_role}},
            )

        return _admin_action_response("Kullanıcı rolü güncellendi.", user)
