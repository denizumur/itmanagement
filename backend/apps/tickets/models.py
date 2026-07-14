from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.employees.models import Employee
from apps.inventory.models import Asset


class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Açık"
        IN_PROGRESS = "in_progress", "İşlemde"
        RESOLVED = "resolved", "Çözüldü"
        CLOSED = "closed", "Kapandı"

    class Priority(models.TextChoices):
        LOW = "low", "Düşük"
        NORMAL = "normal", "Normal"
        HIGH = "high", "Yüksek"
        URGENT = "urgent", "Acil"

    class Category(models.TextChoices):
        HARDWARE = "hardware", "Donanım"
        SOFTWARE = "software", "Yazılım"
        ACCESS = "access", "Erişim / Yetki"
        NETWORK = "network", "Ağ / İnternet"
        OTHER = "other", "Diğer"

    class ApprovalStatus(models.TextChoices):
        NOT_REQUIRED = "not_required", "Onay gerekmiyor"
        PENDING = "pending", "Onay bekliyor"
        APPROVED = "approved", "Onaylandı"
        REJECTED = "rejected", "Reddedildi"

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="tickets",
    )
    asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        related_name="tickets",
        null=True,
        blank=True,
    )

    title = models.CharField(max_length=180)
    description = models.TextField()

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.OTHER,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
    )

    approval_status = models.CharField(
        max_length=30,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.NOT_REQUIRED,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.OPEN,
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_tickets",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_tickets",
        null=True,
        blank=True,
    )

    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ticket"
        verbose_name_plural = "Ticketlar"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["approval_status"]),
            models.Index(fields=["employee", "status"]),
            models.Index(fields=["assigned_to", "status"]),
            models.Index(fields=["created_at"]),
        ]

    def clean(self):
        super().clean()

        if self.assigned_to and self.approval_status not in {
            self.ApprovalStatus.NOT_REQUIRED,
            self.ApprovalStatus.APPROVED,
        }:
            raise ValidationError(
                {
                    "assigned_to": (
                        "Onay bekleyen veya reddedilmiş ticket IT personeline atanamaz."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"#{self.id} - {self.title}"


class TicketComment(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="ticket_comments",
        null=True,
        blank=True,
    )
    body = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        help_text="IT iç notu. Requester kullanıcıları göremez.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ticket Yorumu"
        verbose_name_plural = "Ticket Yorumları"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["ticket", "created_at"]),
            models.Index(fields=["is_internal"]),
        ]

    def __str__(self):
        return f"Ticket #{self.ticket_id} comment"