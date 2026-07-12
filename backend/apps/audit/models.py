from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Oluşturma"
        UPDATE = "update", "Güncelleme"
        DELETE = "delete", "Silme"
        RESTORE = "restore", "Geri Alma"
        ASSIGN = "assign", "Zimmetleme"
        RETURN = "return", "İade Alma"
        DISPOSE = "dispose", "İmha"
        STATUS_CHANGE = "status_change", "Durum Değişikliği"
        LOGIN = "login", "Giriş"
        LOGOUT = "logout", "Çıkış"
        OTHER = "other", "Diğer"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="İşlemi Yapan Kullanıcı",
    )

    action = models.CharField(
        max_length=32,
        choices=Action.choices,
        db_index=True,
        verbose_name="İşlem",
    )

    entity_type = models.CharField(
        max_length=120,
        db_index=True,
        verbose_name="Varlık Tipi",
        help_text="Örn: inventory.Asset, assignments.Assignment, maintenance.MaintenanceRecord",
    )

    entity_id = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        verbose_name="Varlık ID",
    )

    entity_repr = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Varlık Görünümü",
        help_text="Log ekranında okunabilir kısa temsil.",
    )

    before = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Önceki Veri",
    )

    after = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Sonraki Veri",
    )

    changes = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Değişiklikler",
        help_text="Sadece değişen alanlar.",
    )

    request_method = models.CharField(
        max_length=16,
        blank=True,
        verbose_name="HTTP Metodu",
    )

    request_path = models.CharField(
        max_length=512,
        blank=True,
        verbose_name="İstek Yolu",
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="IP Adresi",
    )

    user_agent = models.TextField(
        blank=True,
        verbose_name="User Agent",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Ek Metadata",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Oluşturulma Tarihi",
    )

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
        ]

    def __str__(self):
        actor_display = self.actor_id or "system"
        entity_display = self.entity_repr or f"{self.entity_type}:{self.entity_id}"
        return f"{self.created_at} | {actor_display} | {self.action} | {entity_display}"