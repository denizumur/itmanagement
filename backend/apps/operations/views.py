import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserInvitation
from apps.accounts.permissions import IsAdminRole
from apps.audit.models import AuditLog
from apps.employees.models import Employee, EmployeeImportJob
from apps.reminders.models import Reminder
from apps.tickets.models import Ticket


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
