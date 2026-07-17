from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import TimeStampedModel


class Reminder(TimeStampedModel):
    class SourceType(models.TextChoices):
        WARRANTY = "warranty", "Garanti"
        MAINTENANCE = "maintenance", "Bakım"
        LICENSE = "license", "Lisans / Abonelik"
        TICKET_SLA = "ticket_sla", "Ticket SLA"

    class Channel(models.TextChoices):
        IN_APP = "in_app", "Uygulama İçi"
        EMAIL = "email", "E-posta"

    class Status(models.TextChoices):
        PENDING = "pending", "Bekliyor"
        SENT = "sent", "Gönderildi"
        DISMISSED = "dismissed", "Gizlendi"
        CANCELLED = "cancelled", "İptal Edildi"

    source_type = models.CharField(
        max_length=30,
        choices=SourceType.choices,
    )

    source_id = models.PositiveIntegerField(
        help_text="Kaynak kaydın ID değeri. Örn: Asset ID veya LicenseSubscription ID.",
    )

    title = models.CharField(max_length=220)
    message = models.TextField()

    due_date = models.DateField(
        help_text="Asıl olay tarihi. Örn: garanti bitiş, bakım tarihi, lisans bitiş tarihi.",
    )

    threshold_days = models.PositiveIntegerField(
        help_text="Kaç gün kala uyarı üretileceği. Örn: 30, 15, 7, 1.",
    )

    scheduled_for = models.DateField(
        help_text="Reminder'ın görünür/işlenebilir olacağı tarih. due_date - threshold_days.",
    )

    channel = models.CharField(
        max_length=30,
        choices=Channel.choices,
        default=Channel.IN_APP,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )

    notified_at = models.DateTimeField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    snoozed_until = models.DateField(
        null=True,
        blank=True,
        help_text="Bugün gizle gibi geçici erteleme tarihi. Bu tarih geçince pending reminder tekrar görünür.",
    )
    snoozed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Kaynak hakkında snapshot bilgi. Örn: asset_code, license_vendor.",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_reminders",
    )

    class Meta:
        verbose_name = "Hatırlatıcı"
        verbose_name_plural = "Hatırlatıcılar"
        ordering = ["scheduled_for", "due_date", "threshold_days"]
        indexes = [
            models.Index(fields=["source_type"]),
            models.Index(fields=["source_id"]),
            models.Index(fields=["snoozed_until"]),
            models.Index(fields=["due_date"]),
            models.Index(fields=["scheduled_for"]),
            models.Index(fields=["threshold_days"]),
            models.Index(fields=["channel"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "source_type",
                    "source_id",
                    "due_date",
                    "threshold_days",
                    "channel",
                ],
                condition=~Q(status="cancelled"),
                name="unique_active_reminder_per_source_due_threshold_channel",
            )
        ]

    def __str__(self):
        return f"{self.get_source_type_display()} - {self.title} - {self.due_date}"

    @property
    def is_due_to_show(self):
        return self.scheduled_for <= timezone.localdate()

    @property
    def days_until_due(self):
        return (self.due_date - timezone.localdate()).days
    @property
    def is_snoozed_today(self):
        today = timezone.localdate()

        return self.snoozed_until is not None and self.snoozed_until >= today

    @property
    def is_visible_today(self):
        return (
            self.status == self.Status.PENDING
            and self.is_due_to_show
            and not self.is_snoozed_today
        )
    def clean(self):
        if self.threshold_days not in [30, 15, 7, 1]:
            raise ValidationError(
                {"threshold_days": "Geçerli eşikler: 30, 15, 7, 1."}
            )

        expected_scheduled_for = self.due_date - timezone.timedelta(
            days=self.threshold_days
        )

        if self.scheduled_for != expected_scheduled_for:
            raise ValidationError(
                {
                    "scheduled_for": (
                        "scheduled_for değeri due_date - threshold_days olmalıdır."
                    )
                }
            )

    def save(self, *args, **kwargs):
        if self.due_date and self.threshold_days:
            self.scheduled_for = self.due_date - timezone.timedelta(
                days=self.threshold_days
            )

        self.full_clean()
        super().save(*args, **kwargs)

    def mark_sent(self):
        self.status = self.Status.SENT
        self.notified_at = timezone.now()
        self.save(update_fields=["status", "notified_at", "updated_at"])

    def dismiss(self):
        self.status = self.Status.DISMISSED
        self.dismissed_at = timezone.now()
        self.save(update_fields=["status", "dismissed_at", "updated_at"])


    def snooze_today(self):
        self.status = self.Status.PENDING
        self.snoozed_until = timezone.localdate()
        self.snoozed_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "snoozed_until",
                "snoozed_at",
                "updated_at",
            ]
        )


    def cancel(self):
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_at", "updated_at"])