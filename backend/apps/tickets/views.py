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
from apps.common.pagination import StandardResultsPagination
from apps.employees.models import Employee
from apps.inventory.models import Asset
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
)
from apps.tickets.services import (
    approve_ticket,
    get_pending_approval_for_user,
    initialize_ticket_approval,
    reject_ticket,
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


def ticket_base_queryset():
    return (
        Ticket.objects.select_related(
            "employee",
            "employee__department",
            "employee__job_title",
            "asset",
            "asset__category",
            "assigned_to",
            "created_by",
        )
        .prefetch_related(
            "comments",
            "attachments",
            "approvals",
            "approvals__approver",
            "approvals__approver_user",
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

        initialize_ticket_approval(ticket, requested_by=request.user)

        ticket.refresh_from_db()

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

        approve_ticket(
            ticket,
            approver_user=request.user,
            decision_note=serializer.validated_data.get("decision_note", ""),
        )

        ticket.refresh_from_db()

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

        reject_ticket(
            ticket,
            approver_user=request.user,
            decision_note=serializer.validated_data.get("decision_note", ""),
        )

        ticket.refresh_from_db()

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

        serializer = TicketStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        now = timezone.now()

        ticket.status = new_status

        if new_status == Ticket.Status.RESOLVED and not ticket.resolved_at:
            ticket.resolved_at = now

        if new_status == Ticket.Status.CLOSED and not ticket.closed_at:
            ticket.closed_at = now

        if new_status in {Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS}:
            ticket.resolved_at = None
            ticket.closed_at = None

        ticket.save()

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

        ticket.assigned_to = serializer.validated_data["assigned_to"]

        if ticket.assigned_to and ticket.status == Ticket.Status.OPEN:
            ticket.status = Ticket.Status.IN_PROGRESS

        ticket.save()

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
                        f"Bir ticket için en fazla {TICKET_ATTACHMENT_MAX_FILES_PER_TICKET} dosya yüklenebilir."
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

        return Response(
            TicketAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )