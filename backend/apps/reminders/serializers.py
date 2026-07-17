from rest_framework import serializers

from apps.reminders.models import Reminder


class ReminderSerializer(serializers.ModelSerializer):
    source_type_label = serializers.CharField(
        source="get_source_type_display",
        read_only=True,
    )
    channel_label = serializers.CharField(
        source="get_channel_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    is_due_to_show = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    is_snoozed_today = serializers.BooleanField(read_only=True)
    is_visible_today = serializers.BooleanField(read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Reminder
        fields = [
            "id",
            "source_type",
            "source_type_label",
            "source_id",
            "title",
            "message",
            "due_date",
            "threshold_days",
            "scheduled_for",
            "channel",
            "channel_label",
            "status",
            "status_label",
            "notified_at",
            "dismissed_at",
            "cancelled_at",
            "snoozed_until",
            "snoozed_at",
            "is_snoozed_today",
            "is_visible_today",
            "metadata",
            "is_due_to_show",
            "days_until_due",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "source_type_label",
            "channel_label",
            "status_label",
            "scheduled_for",
            "notified_at",
            "snoozed_until",
            "snoozed_at",
            "is_snoozed_today",
            "is_visible_today",
            "dismissed_at",
            "cancelled_at",
            "is_due_to_show",
            "days_until_due",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]


class ReminderGenerateSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(
        choices=Reminder.Channel.choices,
        default=Reminder.Channel.IN_APP,
    )