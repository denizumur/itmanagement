from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import UserProfile
from apps.assignments.models import Assignment
from apps.tickets.models import (
    TICKET_ATTACHMENT_ALLOWED_MIME_TYPES,
    TICKET_ATTACHMENT_MAX_FILE_SIZE_BYTES,
    TICKET_ATTACHMENT_MAX_FILES_PER_TICKET,
    Ticket,
    TicketApproval,
    TicketAttachment,
    TicketComment,
    validate_ticket_attachment_file,
)

User = get_user_model()


class TicketSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_email = serializers.EmailField(source="employee.email", read_only=True)
    asset_label = serializers.SerializerMethodField()

    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()
    pending_approver_name = serializers.SerializerMethodField()

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    approval_status_label = serializers.CharField(
        source="get_approval_status_display",
        read_only=True,
    )

    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    attachments_count = serializers.IntegerField(
        source="attachments.count",
        read_only=True,
    )

    class Meta:
        model = Ticket
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_email",
            "asset",
            "asset_label",
            "title",
            "description",
            "category",
            "category_label",
            "priority",
            "priority_label",
            "approval_status",
            "approval_status_label",
            "pending_approver_name",
            "status",
            "status_label",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "resolution_note",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "closed_by",
            "closed_by_name",
            "closed_at",
            "comments_count",
            "attachments_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "employee",
            "approval_status",
            "pending_approver_name",
            "status",
            "assigned_to",
            "created_by",
            "resolution_note",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "closed_by",
            "closed_by_name",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def get_asset_label(self, obj):
        if not obj.asset:
            return None

        return str(obj.asset)

    def get_assigned_to_name(self, obj):
        return get_user_display_name(obj.assigned_to)

    def get_created_by_name(self, obj):
        return get_user_display_name(obj.created_by)

    def get_resolved_by_name(self, obj):
        return get_user_display_name(obj.resolved_by)

    def get_closed_by_name(self, obj):
        return get_user_display_name(obj.closed_by)

    def get_pending_approver_name(self, obj):
        approval = next(
            (
                item
                for item in obj.approvals.all()
                if item.status == TicketApproval.Status.PENDING
            ),
            None,
        )

        if not approval:
            return None

        return approval.approver.full_name


class TicketCreateSerializer(serializers.Serializer):
    asset = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField(max_length=180)
    description = serializers.CharField()
    category = serializers.ChoiceField(
        choices=Ticket.Category.choices,
        default=Ticket.Category.OTHER,
    )
    priority = serializers.ChoiceField(
        choices=Ticket.Priority.choices,
        default=Ticket.Priority.NORMAL,
    )

    def validate_title(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError("Talep başlığı en az 3 karakter olmalı.")

        return value

    def validate_description(self, value):
        value = value.strip()

        if len(value) < 10:
            raise serializers.ValidationError("Açıklama en az 10 karakter olmalı.")

        return value


class TicketStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Ticket.Status.choices)
    solution_note = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        ticket = self.context.get("ticket")
        new_status = attrs.get("status")
        solution_note = (attrs.get("solution_note") or "").strip()

        if new_status in {Ticket.Status.RESOLVED, Ticket.Status.CLOSED}:
            existing_note = getattr(ticket, "resolution_note", "") if ticket else ""

            if not solution_note and not existing_note:
                raise serializers.ValidationError(
                    {
                        "solution_note": (
                            "Ticket çözüldü veya kapandı yapılırken çözüm notu zorunludur."
                        )
                    }
                )

        return attrs


class TicketAssignSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        allow_null=True,
        required=True,
    )

    def validate_assigned_to(self, user):
        if user is None:
            return user

        role = getattr(getattr(user, "profile", None), "role", None)

        if role not in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.TECHNICIAN,
        }:
            raise serializers.ValidationError(
                "Ticket yalnızca Admin veya Technician rolündeki kullanıcıya atanabilir."
            )

        return user


class TicketApprovalDecisionSerializer(serializers.Serializer):
    decision_note = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
    )


class TicketApprovalSerializer(serializers.ModelSerializer):
    ticket = TicketSerializer(read_only=True)
    approver_name = serializers.CharField(source="approver.full_name", read_only=True)
    approver_username = serializers.CharField(
        source="approver_user.username",
        read_only=True,
        allow_null=True,
    )
    requested_by_username = serializers.CharField(
        source="requested_by.username",
        read_only=True,
        allow_null=True,
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = TicketApproval
        fields = [
            "id",
            "ticket",
            "approver",
            "approver_name",
            "approver_user",
            "approver_username",
            "requested_by",
            "requested_by_username",
            "status",
            "status_label",
            "decision_note",
            "requested_at",
            "decided_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class TicketCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketComment
        fields = [
            "id",
            "ticket",
            "author",
            "author_name",
            "body",
            "is_internal",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "ticket",
            "author",
            "author_name",
            "created_at",
        ]

    def validate_body(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Yorum boş olamaz.")

        return value

    def get_author_name(self, obj):
        return get_user_display_name(obj.author)


class TicketAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = [
            "id",
            "ticket",
            "original_filename",
            "mime_type",
            "size_bytes",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
            "download_url",
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj):
        return get_user_display_name(obj.uploaded_by)

    def get_download_url(self, obj):
        return f"/api/tickets/attachments/{obj.id}/download/"


class TicketAttachmentCreateSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, uploaded_file):
        validate_ticket_attachment_file(uploaded_file)
        return uploaded_file


class RequesterContextSerializer(serializers.Serializer):
    """
    Swagger/OpenAPI görünürlüğü için response shape tanımı.
    Runtime response views.py içinde hazırlanır.
    """


def get_user_display_name(user):
    if not user:
        return None

    full_name = user.get_full_name()
    return full_name or user.username


def serialize_assignment_for_requester_context(assignment):
    asset = assignment.asset

    return {
        "id": assignment.id,
        "asset_id": asset.id,
        "asset_name": asset.name,
        "asset_inventory_code": asset.inventory_code,
        "asset_serial_number": asset.serial_number,
        "asset_category": asset.category.name if asset.category_id else None,
        "asset_status": asset.status,
        "asset_status_label": asset.get_status_display(),
        "asset_display_identifier": asset.display_identifier,
        "assigned_at": assignment.assigned_at,
    }


def serialize_assignment_for_ticket_context(assignment):
    asset = assignment.asset

    return {
        "id": assignment.id,
        "asset": {
            "id": asset.id,
            "name": asset.name,
            "inventory_code": asset.inventory_code,
            "serial_number": asset.serial_number,
            "display_identifier": asset.display_identifier,
            "category": asset.category.name if asset.category_id else None,
            "status": asset.status,
            "status_label": asset.get_status_display(),
            "location": asset.location,
        },
        "employee": {
            "id": assignment.employee_id,
            "full_name": assignment.employee.full_name,
            "email": assignment.employee.email,
        },
        "assigned_at": assignment.assigned_at,
        "returned_at": assignment.returned_at,
        "is_active": assignment.is_active,
    }


def serialize_employee_for_ticket_context(employee):
    return {
        "id": employee.id,
        "full_name": employee.full_name,
        "email": employee.email,
        "phone": getattr(employee, "phone", ""),
        "employee_code": getattr(employee, "employee_code", ""),
        "department": (
            {
                "id": employee.department_id,
                "name": employee.department.name,
            }
            if employee.department
            else None
        ),
        "job_title": (
            {
                "id": employee.job_title_id,
                "name": employee.job_title.name,
            }
            if employee.job_title
            else None
        ),
        "manager": (
            {
                "id": employee.manager_id,
                "full_name": employee.manager.full_name,
                "email": employee.manager.email,
            }
            if employee.manager
            else None
        ),
        "is_active": employee.is_active,
    }


def serialize_asset_for_ticket_context(asset):
    if not asset:
        return None

    return {
        "id": asset.id,
        "name": asset.name,
        "brand": asset.brand,
        "model": asset.model,
        "inventory_code": asset.inventory_code,
        "serial_number": asset.serial_number,
        "display_identifier": asset.display_identifier,
        "category": asset.category.name if asset.category_id else None,
        "status": asset.status,
        "status_label": asset.get_status_display(),
        "location": asset.location,
        "ip_address": asset.ip_address,
        "mac_address": asset.mac_address,
        "warranty_end_date": asset.warranty_end_date,
        "next_maintenance_due_date": asset.next_maintenance_due_date,
    }


def serialize_recent_ticket_for_context(ticket):
    return {
        "id": ticket.id,
        "title": ticket.title,
        "status": ticket.status,
        "status_label": ticket.get_status_display(),
        "priority": ticket.priority,
        "priority_label": ticket.get_priority_display(),
        "approval_status": ticket.approval_status,
        "approval_status_label": ticket.get_approval_status_display(),
        "category": ticket.category,
        "category_label": ticket.get_category_display(),
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "resolved_at": ticket.resolved_at,
        "closed_at": ticket.closed_at,
    }


def serialize_approval_for_ticket_context(approval):
    return {
        "id": approval.id,
        "approver": {
            "id": approval.approver_id,
            "full_name": approval.approver.full_name,
            "email": approval.approver.email,
        },
        "approver_user": (
            {
                "id": approval.approver_user_id,
                "username": approval.approver_user.username,
                "display_name": get_user_display_name(approval.approver_user),
            }
            if approval.approver_user
            else None
        ),
        "requested_by": (
            {
                "id": approval.requested_by_id,
                "username": approval.requested_by.username,
                "display_name": get_user_display_name(approval.requested_by),
            }
            if approval.requested_by
            else None
        ),
        "status": approval.status,
        "status_label": approval.get_status_display(),
        "decision_note": approval.decision_note,
        "requested_at": approval.requested_at,
        "decided_at": approval.decided_at,
    }


def get_ticket_attachment_limits():
    return {
        "max_file_size_bytes": TICKET_ATTACHMENT_MAX_FILE_SIZE_BYTES,
        "max_file_size_mb": int(TICKET_ATTACHMENT_MAX_FILE_SIZE_BYTES / 1024 / 1024),
        "max_files_per_ticket": TICKET_ATTACHMENT_MAX_FILES_PER_TICKET,
        "allowed_mime_types": sorted(TICKET_ATTACHMENT_ALLOWED_MIME_TYPES),
    }


def build_requester_context(employee):
    manager = employee.manager
    manager_user = manager.user if manager else None
    manager_role = getattr(getattr(manager_user, "profile", None), "role", None)

    requires_approval = manager_role in {
        UserProfile.Role.ADMIN,
        UserProfile.Role.APPROVER,
    }

    active_assignments = (
        Assignment.objects.select_related(
            "asset",
            "asset__category",
        )
        .filter(
            employee=employee,
            returned_at__isnull=True,
            asset__is_deleted=False,
        )
        .order_by("-assigned_at")
    )

    return {
        "employee": serialize_employee_for_ticket_context(employee),
        "active_assignments": [
            serialize_assignment_for_requester_context(assignment)
            for assignment in active_assignments
        ],
        "approval_preview": {
            "requires_approval": requires_approval,
            "approver_name": manager.full_name if requires_approval and manager else None,
            "approver_email": manager.email if requires_approval and manager else None,
            "approver_role": manager_role if requires_approval else None,
        },
        "limits": get_ticket_attachment_limits(),
    }


def build_ticket_context(ticket, *, action_permissions):
    employee = ticket.employee
    asset = ticket.asset

    active_assignments = (
        Assignment.objects.select_related(
            "asset",
            "asset__category",
            "employee",
        )
        .filter(
            employee=employee,
            returned_at__isnull=True,
            asset__is_deleted=False,
        )
        .order_by("-assigned_at")
    )

    requester_recent_tickets = (
        Ticket.objects.select_related("asset", "employee")
        .filter(employee=employee)
        .exclude(id=ticket.id)
        .order_by("-created_at")[:5]
    )

    asset_recent_tickets = []
    if asset:
        asset_recent_tickets = (
            Ticket.objects.select_related("asset", "employee")
            .filter(asset=asset)
            .exclude(id=ticket.id)
            .order_by("-created_at")[:5]
        )

    approvals = ticket.approvals.select_related(
        "approver",
        "approver_user",
        "requested_by",
    ).order_by("-requested_at")

    pending_approval = next(
        (
            approval
            for approval in approvals
            if approval.status == TicketApproval.Status.PENDING
        ),
        None,
    )

    comments_queryset = ticket.comments.all()
    attachments_queryset = ticket.attachments.all()

    return {
        "ticket": TicketSerializer(ticket).data,
        "requester": serialize_employee_for_ticket_context(employee),
        "asset": serialize_asset_for_ticket_context(asset),
        "active_assignments": [
            serialize_assignment_for_ticket_context(assignment)
            for assignment in active_assignments
        ],
        "requester_recent_tickets": [
            serialize_recent_ticket_for_context(recent_ticket)
            for recent_ticket in requester_recent_tickets
        ],
        "asset_recent_tickets": [
            serialize_recent_ticket_for_context(recent_ticket)
            for recent_ticket in asset_recent_tickets
        ],
        "approval": {
            "status": ticket.approval_status,
            "status_label": ticket.get_approval_status_display(),
            "pending": (
                serialize_approval_for_ticket_context(pending_approval)
                if pending_approval
                else None
            ),
            "history": [
                serialize_approval_for_ticket_context(approval)
                for approval in approvals
            ],
        },
        "comments_summary": {
            "total": comments_queryset.count(),
            "public": comments_queryset.filter(is_internal=False).count(),
            "internal": comments_queryset.filter(is_internal=True).count(),
        },
        "attachments_summary": {
            "total": attachments_queryset.count(),
            "latest": [
                TicketAttachmentSerializer(attachment).data
                for attachment in attachments_queryset.select_related("uploaded_by")[:5]
            ],
            "limits": get_ticket_attachment_limits(),
        },
        "transition_rules": {
            "allowed_statuses": [
                Ticket.Status.OPEN,
                Ticket.Status.IN_PROGRESS,
                Ticket.Status.RESOLVED,
                Ticket.Status.CLOSED,
            ],
            "requires_solution_note_for": [
                Ticket.Status.RESOLVED,
                Ticket.Status.CLOSED,
            ],
        },
        "actions": action_permissions,
    }