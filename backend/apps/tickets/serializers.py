from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import UserProfile
from apps.tickets.models import Ticket, TicketComment

User = get_user_model()


class TicketSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_email = serializers.EmailField(source="employee.email", read_only=True)
    asset_label = serializers.SerializerMethodField()

    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    approval_status_label = serializers.CharField(
        source="get_approval_status_display",
        read_only=True,
    )

    comments_count = serializers.IntegerField(source="comments.count", read_only=True)

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
            "status",
            "status_label",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "comments_count",
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "employee",
            "approval_status",
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
            raise serializers.ValidationError("Ticket başlığı en az 3 karakter olmalı.")

        return value

    def validate_description(self, value):
        value = value.strip()

        if len(value) < 10:
            raise serializers.ValidationError(
                "Açıklama en az 10 karakter olmalı."
            )

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

    def get_author_name(self, obj):
        if not obj.author:
            return None

        full_name = obj.author.get_full_name()
        return full_name or obj.author.username