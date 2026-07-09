from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel
from apps.inventory.models import Asset


class MaintenanceRecord(TimeStampedModel):
    class Type(models.TextChoices):
        MAINTENANCE = "maintenance", "Bakım"
        REPAIR = "repair", "Onarım"
        DISPOSAL = "disposal", "İmha"

    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name="maintenance_records",
    )

    type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.MAINTENANCE,
    )

    performed_at = models.DateField(
        default=timezone.localdate,
        help_text="Bakım/onarım/imha işleminin yapıldığı tarih.",
    )

    next_due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Bir sonraki bakım tarihi. Reminder motoru buradan uyarı üretecek.",
    )

    frequency_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Periyodik bakım sıklığı. Örn: 90 gün.",
    )

    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )

    performed_by = models.CharField(
        max_length=180,
        blank=True,
        help_text="İşlemi yapan kişi/firma. Örn: Bilgi İşlem, Servis Firması.",
    )

    description = models.TextField()

    asset_status_before = models.CharField(
        max_length=30,
        choices=Asset.Status.choices,
        blank=True,
        help_text="İşlem öncesi varlık durumu. Sistem tarafından doldurulur.",
    )

    asset_status_after = models.CharField(
        max_length=30,
        choices=Asset.Status.choices,
        blank=True,
        help_text=(
            "İşlem sonrası varlık durumu. Boş bırakılırsa tipe göre sistem "
            "makul varsayılan uygular."
        ),
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_maintenance_records",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_maintenance_records",
    )

    class Meta:
        verbose_name = "Bakım / Onarım Kaydı"
        verbose_name_plural = "Bakım / Onarım Kayıtları"
        ordering = ["-performed_at", "-created_at"]
        indexes = [
            models.Index(fields=["asset"]),
            models.Index(fields=["type"]),
            models.Index(fields=["performed_at"]),
            models.Index(fields=["next_due_date"]),
            models.Index(fields=["created_by"]),
        ]

    def __str__(self):
        return f"{self.asset} - {self.get_type_display()} - {self.performed_at}"

    def clean(self):
        if self.asset and self.asset.is_deleted:
            raise ValidationError({"asset": "Silinmiş varlığa bakım kaydı girilemez."})

        if self.next_due_date and self.next_due_date < self.performed_at:
            raise ValidationError(
                {
                    "next_due_date": (
                        "Sonraki bakım tarihi işlem tarihinden önce olamaz."
                    )
                }
            )

        if self.type == self.Type.DISPOSAL:
            if self.next_due_date:
                raise ValidationError(
                    {
                        "next_due_date": (
                            "İmha kaydı için sonraki bakım tarihi girilemez."
                        )
                    }
                )

            if self.frequency_days:
                raise ValidationError(
                    {
                        "frequency_days": (
                            "İmha kaydı için bakım sıklığı girilemez."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        if self.frequency_days and not self.next_due_date:
            self.next_due_date = self.performed_at + timedelta(
                days=self.frequency_days
            )

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        if not self.next_due_date:
            return False

        return self.next_due_date < timezone.localdate()