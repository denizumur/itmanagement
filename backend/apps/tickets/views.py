from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import UserProfile
from apps.assignments.models import Assignment
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, serialize_instance
from apps.common.pagination import StandardResultsPagination
from apps.employees.models import Employee
from apps.tickets.filters import TicketFilterSet
from apps.tickets.models import (
    TICKET_ATTACHMENT_MAX_FILES_PER_TICKET,
    Ticket,
    TicketApproval,
    TicketAttachment,
    TicketComment,
)
from apps.tickets.serializers import (
    TicketApprovalDecisionSerializer,
    TicketApprovalSerializer,
    TicketAssignSerializer,
    TicketAttachmentCreateSerializer,
    TicketAttachmentSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketSerializer,
    TicketStatusUpdateSerializer,
    build_requester_context,
    build_ticket_context,
)
from apps.tickets.services import (
    approve_ticket,
    get_pending_approval_for_user,
    initialize_ticket_approval,
    reject_ticket,
)
from apps.tickets.timeline import build_ticket_timeline


TICKET_AUDIT_EXCLUDE_FIELDS = (
    "created_at",
    "updated_at",
)


def get_user_role(user):
    return getattr(getattr(user, "profile", None), "role", None)


def is_requester(user):
    return get_user_role(user) == UserProfile.Role.REQUESTER


def is_approver(user):
    return get_user_role(user) in {
        UserProfile.Role.APPROVER,
        UserProfile.Role.ADMIN,
    }


def can_manage_tickets(user):
    return get_user_role(user) in {
        UserProfile.Role.ADMIN,
        UserProfile.Role.TECHNICIAN,
    }


def can_view_it_queue(user):
    return get_user_role(user) in {
        UserProfile.Role.ADMIN,
        UserProfile.Role.TECHNICIAN,
        UserProfile.Role.VIEWER,
    }


def ticket_can_enter_it_queue(ticket):
    return ticket.approval_status in {
        Ticket.ApprovalStatus.NOT_REQUIRED,
        Ticket.ApprovalStatus.APPROVED,
    }


def get_display_name(user):
    if not user:
        return None

    full_name = user.get_full_name()

    return full_name or user.username or str(user)


def get_choice_label(choices, value):
    return dict(choices).get(value, value)


def create_ticket_audit_log(
    *,
    request,
    ticket,
    action,
    operation,
    before=None,
    after=None,
    changes=None,
    timeline_type=None,
    metadata=None,
):
    audit_metadata = {
        "module": "tickets",
        "operation": operation,
        "ticket_id": ticket.id,
    }

    if timeline_type:
        audit_metadata["timeline_type"] = timeline_type

    if metadata:
        audit_metadata.update(metadata)

    return create_audit_log(
        request=request,
        action=action,
        instance=ticket,
        before=before or {},
        after=after,
        changes=changes,
        metadata=audit_metadata,
    )


def create_solution_comment_if_needed(ticket, user, solution_note, request=None):
    solution_note = (solution_note or "").strip()

    if not solution_note:
        return None

    comment = TicketComment.objects.create(
        ticket=ticket,
        author=user,
        body=f"Çözüm notu: {solution_note}",
        is_internal=False,
    )

    create_audit_log(
        request=request,
        action=AuditLog.Action.CREATE,
        instance=comment,
        before={},
        after=serialize_instance(comment, exclude=("created_at",)),
        metadata={
            "module": "tickets",
            "operation": "ticket_solution_note_added",
            "ticket_id": ticket.id,
            "timeline_type": "solution_note_added",
            "comment_id": comment.id,
            "is_internal": False,
        },
    )

    return comment


def build_ticket_action_permissions(user, ticket):
    can_manage = can_manage_tickets(user)
    can_enter_it_queue = ticket_can_enter_it_queue(ticket)
    can_change_it_fields = can_manage and can_enter_it_queue

    return {
        "can_view_context": can_view_it_queue(user),
        "can_update_status": can_change_it_fields,
        "can_assign_ticket": can_change_it_fields,
        "can_add_public_reply": can_manage,
        "can_add_internal_note": can_manage,
        "can_upload_attachment": can_manage,
        "can_download_attachment": can_manage,
        "can_view_internal_notes": can_manage,
        "is_read_only": get_user_role(user) == UserProfile.Role.VIEWER,
        "blocked_reason": (
            None
            if can_enter_it_queue
            else "Onay bekleyen veya reddedilmiş ticket üzerinde IT işlemi yapılamaz."
        ),
    }


def ticket_base_queryset():
    return (
        Ticket.objects.select_related(
            "employee",
            "employee__department",
            "employee__job_title",
            "employee__manager",
            "employee__manager__user",
            "asset",
            "asset__category",
            "assigned_to",
            "created_by",
            "resolved_by",
            "closed_by",
        )
        .prefetch_related(
            "comments",
            "attachments",
            "attachments__uploaded_by",
            "approvals",
            "approvals__approver",
            "approvals__approver_user",
            "approvals__requested_by",
        )
        .order_by("-created_at")
    )


def get_accessible_ticket_queryset(user):
    queryset = ticket_base_queryset()

    if is_requester(user):
        return queryset.filter(employee__user=user)

    if can_view_it_queue(user):
        return queryset

    if is_approver(user):
        return queryset.filter(approvals__approver_user=user).distinct()

    return queryset.none()


def get_ticket_table_queryset(user):
    queryset = get_accessible_ticket_queryset(user)

    if can_view_it_queue(user) and not is_requester(user):
        return queryset.exclude(status=Ticket.Status.CLOSED).filter(
            approval_status__in=[
                Ticket.ApprovalStatus.NOT_REQUIRED,
                Ticket.ApprovalStatus.APPROVED,
            ]
        )

    return queryset


def get_active_employee_for_requester(user):
    return (
        Employee.objects.select_related(
            "department",
            "job_title",
            "manager",
            "manager__user",
            "manager__user__profile",
        )
        .filter(
            user=user,
            is_active=True,
        )
        .first()
    )


def get_requester_owned_active_asset(employee, asset_id):
    assignment = (
        Assignment.objects.select_related(
            "asset",
            "asset__category",
        )
        .filter(
            employee=employee,
            asset_id=asset_id,
            returned_at__isnull=True,
            asset__is_deleted=False,
        )
        .first()
    )

    if not assignment:
        return None

    return assignment.asset


def user_can_access_ticket_attachment(user, attachment):
    ticket = attachment.ticket

    if can_manage_tickets(user):
        return True

    if is_requester(user):
        return ticket.employee.user_id == user.id

    return False


class TicketTableListAPIView(ListAPIView):
    serializer_class = TicketSerializer
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = TicketFilterSet

    search_fields = [
        "title",
        "description",
        "employee__full_name",
        "employee__email",
        "employee__employee_code",
        "asset__name",
        "asset__inventory_code",
        "assigned_to__username",
        "assigned_to__first_name",
        "assigned_to__last_name",
        "created_by__username",
        "created_by__first_name",
        "created_by__last_name",
    ]

    ordering_fields = [
        "title",
        "status",
        "priority",
        "category",
        "approval_status",
        "employee__full_name",
        "assigned_to__username",
        "created_at",
        "updated_at",
        "resolved_at",
        "closed_at",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):
        return get_ticket_table_queryset(self.request.user).order_by("-created_at")


class TicketAttachmentDownloadAPIView(APIView):
    def get(self, request, pk):
        attachment = get_object_or_404(
            TicketAttachment.objects.select_related(
                "ticket",
                "ticket__employee",
                "ticket__employee__user",
            ),
            pk=pk,
        )

        if not user_can_access_ticket_attachment(request.user, attachment):
            raise PermissionDenied("Bu eki indirme yetkin yok.")

        try:
            file_handle = attachment.file.open("rb")
        except FileNotFoundError as exc:
            raise Http404("Dosya bulunamadı.") from exc

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=attachment.original_filename,
            content_type=attachment.mime_type,
        )


class TicketViewSet(ModelViewSet):
    serializer_class = TicketSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return get_accessible_ticket_queryset(self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer

        return TicketSerializer

    def create(self, request, *args, **kwargs):
        if not is_requester(request.user):
            raise PermissionDenied(
                "Bu fazda ticket oluşturma yalnızca Requester rolü içindir."
            )

        employee = get_active_employee_for_requester(request.user)

        if not employee:
            raise ValidationError(
                {
                    "employee": (
                        "Bu kullanıcı aktif bir personel kaydıyla eşleştirilmemiş."
                    )
                }
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        asset = None
        asset_id = serializer.validated_data.get("asset")

        if asset_id:
            asset = get_requester_owned_active_asset(employee, asset_id)

            if not asset:
                raise ValidationError(
                    {
                        "asset": (
                            "Seçilen cihaz aktif zimmetleriniz arasında bulunamadı."
                        )
                    }
                )

        ticket = Ticket.objects.create(
            employee=employee,
            asset=asset,
            title=serializer.validated_data["title"],
            description=serializer.validated_data["description"],
            category=serializer.validated_data["category"],
            priority=serializer.validated_data["priority"],
            approval_status=Ticket.ApprovalStatus.NOT_REQUIRED,
            status=Ticket.Status.OPEN,
            created_by=request.user,
        )

        approval = initialize_ticket_approval(ticket, requested_by=request.user)

        ticket.refresh_from_db()

        create_ticket_audit_log(
            request=request,
            action=AuditLog.Action.CREATE,
            ticket=ticket,
            operation="ticket_created",
            before={},
            after=serialize_instance(ticket, exclude=TICKET_AUDIT_EXCLUDE_FIELDS),
            metadata={
                "asset_id": ticket.asset_id,
                "employee_id": ticket.employee_id,
                "status": ticket.status,
                "approval_status": ticket.approval_status,
                "priority": ticket.priority,
                "category": ticket.category,
            },
        )

        if approval:
            create_audit_log(
                request=request,
                action=AuditLog.Action.CREATE,
                instance=approval,
                before={},
                after=serialize_instance(
                    approval,
                    exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
                ),
                metadata={
                    "module": "tickets",
                    "operation": "ticket_approval_requested",
                    "ticket_id": ticket.id,
                    "timeline_type": "approval_requested",
                    "approval_id": approval.id,
                    "approver_id": approval.approver_id,
                    "approver_user_id": approval.approver_user_id,
                },
            )

        output_serializer = TicketSerializer(ticket, context={"request": request})

        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        raise PermissionDenied(
            "Ticket güncellemek için status veya assign aksiyonlarını kullan."
        )

    @action(detail=False, methods=["get"], url_path="requester-context")
    def requester_context(self, request):
        if not is_requester(request.user):
            raise PermissionDenied("Requester context yalnızca requester rolü içindir.")

        employee = get_active_employee_for_requester(request.user)

        if not employee:
            raise ValidationError(
                {
                    "employee": (
                        "Bu kullanıcı aktif bir personel kaydıyla eşleştirilmemiş."
                    )
                }
            )

        return Response(build_requester_context(employee))

    @action(detail=True, methods=["get"], url_path="context")
    def context(self, request, pk=None):
        if not can_view_it_queue(request.user):
            raise PermissionDenied("Ticket context görüntüleme yetkin yok.")

        ticket = self.get_object()
        permissions = build_ticket_action_permissions(request.user, ticket)

        return Response(
            build_ticket_context(
                ticket,
                action_permissions=permissions,
            )
        )

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        if not can_view_it_queue(request.user):
            raise PermissionDenied("Ticket timeline görüntüleme yetkin yok.")

        ticket = self.get_object()

        return Response(build_ticket_timeline(ticket))

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = get_ticket_table_queryset(request.user)

        high_or_urgent = queryset.filter(
            priority__in=[
                Ticket.Priority.HIGH,
                Ticket.Priority.URGENT,
            ]
        ).count()

        data = {
            "total": queryset.count(),
            "open": queryset.filter(status=Ticket.Status.OPEN).count(),
            "in_progress": queryset.filter(status=Ticket.Status.IN_PROGRESS).count(),
            "resolved": queryset.filter(status=Ticket.Status.RESOLVED).count(),
            "closed": queryset.filter(status=Ticket.Status.CLOSED).count(),
            "urgent": queryset.filter(priority=Ticket.Priority.URGENT).count(),
            "high": queryset.filter(priority=Ticket.Priority.HIGH).count(),
            "high_or_urgent": high_or_urgent,
            "pending_approval": queryset.filter(
                approval_status=Ticket.ApprovalStatus.PENDING,
            ).count(),
            "approved_or_not_required_open": queryset.filter(
                status__in=[
                    Ticket.Status.OPEN,
                    Ticket.Status.IN_PROGRESS,
                ],
                approval_status__in=[
                    Ticket.ApprovalStatus.NOT_REQUIRED,
                    Ticket.ApprovalStatus.APPROVED,
                ],
            ).count(),
        }

        return Response(data)

    @action(detail=False, methods=["get"], url_path="queue")
    def queue(self, request):
        if not can_view_it_queue(request.user):
            raise PermissionDenied("IT ticket kuyruğunu görüntüleme yetkin yok.")

        queryset = self.filter_queryset(
            self.get_queryset()
            .exclude(status=Ticket.Status.CLOSED)
            .filter(
                approval_status__in=[
                    Ticket.ApprovalStatus.NOT_REQUIRED,
                    Ticket.ApprovalStatus.APPROVED,
                ]
            )
        )
        serializer = TicketSerializer(
            queryset,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="approvals")
    def approvals(self, request):
        if not is_approver(request.user):
            raise PermissionDenied("Ticket onaylarını görüntüleme yetkin yok.")

        queryset = TicketApproval.objects.select_related(
            "ticket",
            "ticket__employee",
            "ticket__asset",
            "ticket__assigned_to",
            "ticket__created_by",
            "approver",
            "approver_user",
            "requested_by",
        ).prefetch_related(
            "ticket__comments",
            "ticket__attachments",
            "ticket__approvals",
            "ticket__approvals__approver",
            "ticket__approvals__approver_user",
        )

        if get_user_role(request.user) != UserProfile.Role.ADMIN:
            queryset = queryset.filter(approver_user=request.user)

        queryset = queryset.filter(status=TicketApproval.Status.PENDING).order_by(
            "-requested_at"
        )

        serializer = TicketApprovalSerializer(
            queryset,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        if not is_approver(request.user):
            raise PermissionDenied("Ticket onaylama yetkin yok.")

        ticket = self.get_object()
        pending_approval = get_pending_approval_for_user(ticket, request.user)

        if not pending_approval:
            raise PermissionDenied("Bu ticket için bekleyen onay yetkin yok.")

        serializer = TicketApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approval_before = serialize_instance(
            pending_approval,
            exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
        )

        approval = approve_ticket(
            ticket,
            approver_user=request.user,
            decision_note=serializer.validated_data.get("decision_note", ""),
        )

        approval.refresh_from_db()
        ticket.refresh_from_db()

        create_audit_log(
            request=request,
            action=AuditLog.Action.STATUS_CHANGE,
            instance=approval,
            before=approval_before,
            after=serialize_instance(
                approval,
                exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
            ),
            metadata={
                "module": "tickets",
                "operation": "ticket_approval_approved",
                "ticket_id": ticket.id,
                "timeline_type": "approval_approved",
                "approval_id": approval.id,
                "decision_note": approval.decision_note,
            },
        )

        return Response(TicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        if not is_approver(request.user):
            raise PermissionDenied("Ticket reddetme yetkin yok.")

        ticket = self.get_object()
        pending_approval = get_pending_approval_for_user(ticket, request.user)

        if not pending_approval:
            raise PermissionDenied("Bu ticket için bekleyen onay yetkin yok.")

        serializer = TicketApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approval_before = serialize_instance(
            pending_approval,
            exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
        )

        approval = reject_ticket(
            ticket,
            approver_user=request.user,
            decision_note=serializer.validated_data.get("decision_note", ""),
        )

        approval.refresh_from_db()
        ticket.refresh_from_db()

        create_audit_log(
            request=request,
            action=AuditLog.Action.STATUS_CHANGE,
            instance=approval,
            before=approval_before,
            after=serialize_instance(
                approval,
                exclude=TICKET_AUDIT_EXCLUDE_FIELDS,
            ),
            metadata={
                "module": "tickets",
                "operation": "ticket_approval_rejected",
                "ticket_id": ticket.id,
                "timeline_type": "approval_rejected",
                "approval_id": approval.id,
                "decision_note": approval.decision_note,
            },
        )

        return Response(TicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, pk=None):
        if not can_manage_tickets(request.user):
            raise PermissionDenied("Ticket durumunu değiştirme yetkin yok.")

        ticket = self.get_object()

        if not ticket_can_enter_it_queue(ticket):
            raise PermissionDenied(
                "Onay bekleyen veya reddedilmiş ticket üzerinde IT işlemi yapılamaz."
            )

        serializer = TicketStatusUpdateSerializer(
            data=request.data,
            context={"ticket": ticket},
        )
        serializer.is_valid(raise_exception=True)

        before = serialize_instance(ticket, exclude=TICKET_AUDIT_EXCLUDE_FIELDS)
        status_before = ticket.status
        status_before_label = ticket.get_status_display()

        new_status = serializer.validated_data["status"]
        solution_note = (serializer.validated_data.get("solution_note") or "").strip()
        now = timezone.now()

        ticket.status = new_status

        if new_status == Ticket.Status.RESOLVED:
            if solution_note:
                ticket.resolution_note = solution_note

            ticket.resolved_at = ticket.resolved_at or now
            ticket.resolved_by = ticket.resolved_by or request.user
            ticket.closed_at = None
            ticket.closed_by = None

            create_solution_comment_if_needed(
                ticket,
                request.user,
                solution_note,
                request=request,
            )

        elif new_status == Ticket.Status.CLOSED:
            if solution_note:
                ticket.resolution_note = solution_note

            if not ticket.resolved_at:
                ticket.resolved_at = now
                ticket.resolved_by = request.user

            ticket.closed_at = ticket.closed_at or now
            ticket.closed_by = ticket.closed_by or request.user

            create_solution_comment_if_needed(
                ticket,
                request.user,
                solution_note,
                request=request,
            )

        elif new_status in {Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS}:
            ticket.resolved_at = None
            ticket.resolved_by = None
            ticket.closed_at = None
            ticket.closed_by = None
            ticket.resolution_note = ""

        ticket.save()
        ticket.refresh_from_db()

        after = serialize_instance(ticket, exclude=TICKET_AUDIT_EXCLUDE_FIELDS)

        create_ticket_audit_log(
            request=request,
            action=AuditLog.Action.STATUS_CHANGE,
            ticket=ticket,
            operation="ticket_status_changed",
            before=before,
            after=after,
            timeline_type="status_changed",
            metadata={
                "status_before": status_before,
                "status_after": ticket.status,
                "status_before_label": status_before_label,
                "status_after_label": ticket.get_status_display(),
                "solution_note_added": bool(solution_note),
            },
        )

        return Response(TicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        if not can_manage_tickets(request.user):
            raise PermissionDenied("Ticket atama yetkin yok.")

        ticket = self.get_object()

        if not ticket_can_enter_it_queue(ticket):
            raise PermissionDenied(
                "Onay bekleyen veya reddedilmiş ticket IT personeline atanamaz."
            )

        serializer = TicketAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        before = serialize_instance(ticket, exclude=TICKET_AUDIT_EXCLUDE_FIELDS)
        assigned_to_before = ticket.assigned_to
        status_before = ticket.status

        ticket.assigned_to = serializer.validated_data["assigned_to"]

        if ticket.assigned_to and ticket.status == Ticket.Status.OPEN:
            ticket.status = Ticket.Status.IN_PROGRESS

        ticket.save()
        ticket.refresh_from_db()

        after = serialize_instance(ticket, exclude=TICKET_AUDIT_EXCLUDE_FIELDS)

        create_ticket_audit_log(
            request=request,
            action=AuditLog.Action.ASSIGN,
            ticket=ticket,
            operation="ticket_assigned_changed",
            before=before,
            after=after,
            timeline_type="assigned_changed",
            metadata={
                "assigned_to_before_id": (
                    assigned_to_before.id if assigned_to_before else None
                ),
                "assigned_to_before_name": get_display_name(assigned_to_before),
                "assigned_to_after_id": ticket.assigned_to_id,
                "assigned_to_after_name": get_display_name(ticket.assigned_to),
                "status_before": status_before,
                "status_after": ticket.status,
                "status_before_label": get_choice_label(
                    Ticket.Status.choices,
                    status_before,
                ),
                "status_after_label": ticket.get_status_display(),
            },
        )

        return Response(TicketSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        ticket = self.get_object()

        if request.method == "GET":
            queryset = ticket.comments.select_related("author")

            if is_requester(request.user):
                queryset = queryset.filter(is_internal=False)

            serializer = TicketCommentSerializer(queryset, many=True)
            return Response(serializer.data)

        serializer = TicketCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_internal = serializer.validated_data.get("is_internal", False)

        if is_requester(request.user):
            is_internal = False

        if is_internal and not can_manage_tickets(request.user):
            raise PermissionDenied("İç not ekleme yetkin yok.")

        comment = TicketComment.objects.create(
            ticket=ticket,
            author=request.user,
            body=serializer.validated_data["body"],
            is_internal=is_internal,
        )

        create_audit_log(
            request=request,
            action=AuditLog.Action.CREATE,
            instance=comment,
            before={},
            after=serialize_instance(comment, exclude=("created_at",)),
            metadata={
                "module": "tickets",
                "operation": (
                    "ticket_internal_note_added"
                    if comment.is_internal
                    else "ticket_public_comment_added"
                ),
                "ticket_id": ticket.id,
                "timeline_type": (
                    "internal_note_added"
                    if comment.is_internal
                    else "public_comment_added"
                ),
                "comment_id": comment.id,
                "is_internal": comment.is_internal,
            },
        )

        return Response(
            TicketCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="attachments",
        parser_classes=[MultiPartParser, FormParser],
    )
    def attachments(self, request, pk=None):
        ticket = self.get_object()

        if request.method == "GET":
            if is_requester(request.user) and ticket.employee.user_id != request.user.id:
                raise PermissionDenied("Bu ticket eklerini görüntüleme yetkin yok.")

            if not is_requester(request.user) and not can_manage_tickets(request.user):
                raise PermissionDenied("Bu ticket eklerini görüntüleme yetkin yok.")

            queryset = ticket.attachments.select_related("uploaded_by")
            serializer = TicketAttachmentSerializer(queryset, many=True)

            return Response(serializer.data)

        if is_requester(request.user) and ticket.employee.user_id != request.user.id:
            raise PermissionDenied("Bu ticket için ek yükleme yetkin yok.")

        if not is_requester(request.user) and not can_manage_tickets(request.user):
            raise PermissionDenied("Bu ticket için ek yükleme yetkin yok.")

        if ticket.attachments.count() >= TICKET_ATTACHMENT_MAX_FILES_PER_TICKET:
            raise ValidationError(
                {
                    "file": (
                        f"Bir ticket için en fazla "
                        f"{TICKET_ATTACHMENT_MAX_FILES_PER_TICKET} dosya yüklenebilir."
                    )
                }
            )

        serializer = TicketAttachmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]

        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            mime_type=getattr(uploaded_file, "content_type", "") or "",
            size_bytes=getattr(uploaded_file, "size", 0) or 0,
            uploaded_by=request.user,
        )

        create_audit_log(
            request=request,
            action=AuditLog.Action.CREATE,
            instance=attachment,
            before={},
            after=serialize_instance(attachment, exclude=("uploaded_at",)),
            metadata={
                "module": "tickets",
                "operation": "ticket_attachment_uploaded",
                "ticket_id": ticket.id,
                "timeline_type": "attachment_uploaded",
                "attachment_id": attachment.id,
                "filename": attachment.original_filename,
                "mime_type": attachment.mime_type,
                "size_bytes": attachment.size_bytes,
            },
        )

        return Response(
            TicketAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )