from django.contrib import admin
from django.utils import timezone

from apps.reminders.models import Reminder


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "source_type",
        "source_id",
        "due_date",
        "threshold_days",
        "scheduled_for",
        "channel",
        "status",
        "is_due_to_show",
        "notified_at",
    )
    list_filter = (
        "source_type",
        "channel",
        "status",
        "threshold_days",
        "due_date",
        "scheduled_for",
    )
    search_fields = (
        "title",
        "message",
        "source_type",
        "source_id",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "notified_at",
        "dismissed_at",
        "cancelled_at",
    )
    actions = (
        "mark_selected_sent",
        "dismiss_selected",
        "cancel_selected",
    )

    fieldsets = (
        (
            "Kaynak",
            {
                "fields": (
                    "source_type",
                    "source_id",
                    "metadata",
                )
            },
        ),
        (
            "Hatırlatıcı İçeriği",
            {
                "fields": (
                    "title",
                    "message",
                    "due_date",
                    "threshold_days",
                    "scheduled_for",
                    "channel",
                    "status",
                )
            },
        ),
        (
            "Zaman Bilgileri",
            {
                "fields": (
                    "notified_at",
                    "dismissed_at",
                    "cancelled_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.action(description="Seçili hatırlatıcıları gönderildi işaretle")
    def mark_selected_sent(self, request, queryset):
        count = queryset.update(
            status=Reminder.Status.SENT,
            notified_at=timezone.now(),
        )
        self.message_user(request, f"{count} hatırlatıcı gönderildi işaretlendi.")

    @admin.action(description="Seçili hatırlatıcıları gizle")
    def dismiss_selected(self, request, queryset):
        count = queryset.update(
            status=Reminder.Status.DISMISSED,
            dismissed_at=timezone.now(),
        )
        self.message_user(request, f"{count} hatırlatıcı gizlendi.")

    @admin.action(description="Seçili hatırlatıcıları iptal et")
    def cancel_selected(self, request, queryset):
        count = queryset.update(
            status=Reminder.Status.CANCELLED,
            cancelled_at=timezone.now(),
        )
        self.message_user(request, f"{count} hatırlatıcı iptal edildi.")