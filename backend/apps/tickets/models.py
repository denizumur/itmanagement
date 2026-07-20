import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.utils import validate_file_name
from django.db import models
from django.db.models import Q

from apps.employees.models import Employee
from apps.inventory.models import Asset


TICKET_ATTACHMENT_ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "application/pdf",
}
TICKET_ATTACHMENT_ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".pdf",
}
TICKET_ATTACHMENT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
TICKET_ATTACHMENT_MAX_FILES_PER_TICKET = 5


def ticket_attachment_upload_to(instance, filename):
    original_name = Path(filename or "attachment").name
    safe_name = validate_file_name(original_name)
    suffix = Path(safe_name).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{suffix}"

    return f"ticket_attachments/ticket_{instance.ticket_id}/{unique_name}"


def validate_ticket_attachment_file(uploaded_file, *, declared_mime_type=None):
    if not uploaded_file:
        raise ValidationError("Dosya zorunludur.")

    file_size = getattr(uploaded_file, "size", 0) or 0

    if file_size <= 0:
        raise ValidationError("Boş dosya yüklenemez.")

    if file_size > TICKET_ATTACHMENT_MAX_FILE_SIZE_BYTES:
        raise ValidationError("Dosya boyutu en fazla 5 MB olabilir.")

    file_name = getattr(uploaded_file, "name", "") or ""
    extension = Path(file_name).suffix.lower()

    if extension not in TICKET_ATTACHMENT_ALLOWED_EXTENSIONS:
        raise ValidationError(
            "Sadece PNG, JPG/JPEG veya PDF dosyaları yüklenebilir."
        )

    content_type = (
        getattr(uploaded_file, "content_type", None)
        or declared_mime_type
        or ""
    )

    if content_type not in TICKET_ATTACHMENT_ALLOWED_MIME_TYPES:
        raise ValidationError(
            "Dosya tipi desteklenmiyor. Sadece PNG, JPG/JPEG veya PDF kabul edilir."
        )

class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Açık"
        IN_PROGRESS = "in_progress", "İşlemde"
        RETURNED_TO_REQUESTER = "returned_to_requester", "Talep sahibine geri gönderildi"
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

    resolution_note = models.TextField(blank=True)

    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="resolved_tickets",
        null=True,
        blank=True,
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="closed_tickets",
        null=True,
        blank=True,
    )
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


class TicketApproval(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Onay bekliyor"
        APPROVED = "approved", "Onaylandı"
        REJECTED = "rejected", "Reddedildi"

    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="approvals",
    )
    approver = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="ticket_approvals",
        help_text="Talebi onaylayacak yönetici/personel.",
    )
    approver_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="ticket_approvals_to_decide",
        null=True,
        blank=True,
        help_text="Onayı verecek sistem kullanıcısı.",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="ticket_approvals_requested",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )
    decision_note = models.TextField(blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ticket Onayı"
        verbose_name_plural = "Ticket Onayları"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["approver_user", "status"]),
            models.Index(fields=["ticket", "status"]),
            models.Index(fields=["requested_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["ticket", "approver_user"],
                condition=Q(status="pending"),
                name="unique_pending_approval_per_ticket_approver",
            )
        ]

    def clean(self):
        super().clean()

        if self.approver and self.approver.user and self.approver_user:
            if self.approver.user_id != self.approver_user_id:
                raise ValidationError(
                    {
                        "approver_user": (
                            "approver_user, approver personelinin bağlı olduğu user olmalıdır."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        if self.approver and self.approver.user and not self.approver_user:
            self.approver_user = self.approver.user

        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ticket #{self.ticket_id} - {self.get_status_display()}"

class TicketITDecision(models.Model):
    class Decision(models.TextChoices):
        RETURNED = "returned", "Geri Çevrildi"

    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="it_decisions",
    )
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ticket_it_decisions",
    )
    decision = models.CharField(
        max_length=30,
        choices=Decision.choices,
        default=Decision.RETURNED,
    )
    comment = models.TextField()
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ticket IT Kararı"
        verbose_name_plural = "Ticket IT Kararları"
        ordering = ["-decided_at"]
        indexes = [
            models.Index(fields=["ticket", "decided_at"]),
            models.Index(fields=["technician", "decided_at"]),
            models.Index(fields=["decision"]),
        ]

    def clean(self):
        super().clean()

        if not (self.comment or "").strip():
            raise ValidationError({"comment": "Geri çevirme açıklaması zorunludur."})

    def save(self, *args, **kwargs):
        self.comment = (self.comment or "").strip()
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ticket #{self.ticket_id} - {self.get_decision_display()}"
    
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


class TicketAttachment(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to=ticket_attachment_upload_to)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    size_bytes = models.PositiveIntegerField(default=0)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="ticket_attachments",
        null=True,
        blank=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ticket Eki"
        verbose_name_plural = "Ticket Ekleri"
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["ticket", "uploaded_at"]),
            models.Index(fields=["uploaded_by", "uploaded_at"]),
            models.Index(fields=["mime_type"]),
        ]

    def clean(self):
        super().clean()

        if self.file:
            validate_ticket_attachment_file(
                self.file,
                declared_mime_type=self.mime_type,
            )
    def save(self, *args, **kwargs):
        if self.file:
            self.original_filename = self.original_filename or Path(
                getattr(self.file, "name", "")
            ).name
            self.mime_type = self.mime_type or getattr(self.file, "content_type", "")
            self.size_bytes = self.size_bytes or getattr(self.file, "size", 0) or 0

        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ticket #{self.ticket_id} - {self.original_filename}"