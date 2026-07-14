from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import UserProfile
from apps.employees.models import Employee
from apps.inventory.models import Asset
from apps.tickets.models import Ticket, TicketApproval, TicketComment
from apps.tickets.serializers import (
    TicketApprovalDecisionSerializer,
    TicketApprovalSerializer,
    TicketAssignSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketSerializer,
    TicketStatusUpdateSerializer,
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


class TicketViewSet(ModelViewSet):
    serializer_class = TicketSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = (
            Ticket.objects.select_related(
                "employee",
                "employee__department",
                "employee__job_title",
                "asset",
                "assigned_to",
                "created_by",
            )
            .prefetch_related(
                "comments",
                "approvals",
                "approvals__approver",
                "approvals__approver_user",
            )
            .order_by("-created_at")
        )

        user = self.request.user

        if is_requester(user):
            return queryset.filter(employee__user=user)

        if can_view_it_queue(user):
            return queryset

        if is_approver(user):
            return queryset.filter(approvals__approver_user=user).distinct()

        return queryset.none()

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer

        return TicketSerializer

    def create(self, request, *args, **kwargs):
        if not is_requester(request.user):
            raise PermissionDenied(
                "Bu fazda ticket oluşturma yalnızca Requester rolü içindir."
            )

        employee = Employee.objects.select_related("manager", "manager__user").filter(
            user=request.user,
            is_active=True,
        ).first()

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
            asset = Asset.objects.filter(id=asset_id).first()

            if not asset:
                raise ValidationError({"asset": "Seçilen varlık bulunamadı."})

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