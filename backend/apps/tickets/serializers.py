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
            "comments_count",
            "attachments_count",
            "resolved_at",
            "closed_at",
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
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def get_asset_label(self, obj):
        if not obj.asset:
            return None

        return str(obj.asset)

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None

        full_name = obj.assigned_to.get_full_name()
        return full_name or obj.assigned_to.username

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None

        full_name = obj.created_by.get_full_name()
        return full_name or obj.created_by.username

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
        if not obj.author:
            return None

        full_name = obj.author.get_full_name()
        return full_name or obj.author.username


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
        if not obj.uploaded_by:
            return None

        full_name = obj.uploaded_by.get_full_name()
        return full_name or obj.uploaded_by.username

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
        "employee": {
            "id": employee.id,
            "full_name": employee.full_name,
            "email": employee.email,
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
                    "id": manager.id,
                    "full_name": manager.full_name,
                    "email": manager.email,
                }
                if manager
                else None
            ),
        },
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