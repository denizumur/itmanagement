from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import SoftDeleteModel, TimeStampedModel
from apps.inventory.models import Asset

def has_masking_character(value):
    return any(marker in value for marker in ["*", "X", "x", "•"])

class LicenseSubscription(TimeStampedModel, SoftDeleteModel):
    class Type(models.TextChoices):
        LICENSE = "license", "Lisans"
        SUBSCRIPTION = "subscription", "Abonelik"

    class BillingCycle(models.TextChoices):
        ONE_TIME = "one_time", "Tek Seferlik"
        MONTHLY = "monthly", "Aylık"
        YEARLY = "yearly", "Yıllık"
        OTHER = "other", "Diğer"

    name = models.CharField(
        max_length=180,
        help_text="Örn: Microsoft 365 Business Premium, Adobe Creative Cloud.",
    )

    tracking_code = models.CharField(
        max_length=80,
        null=True,
        blank=True,
        help_text="Şirket içi lisans/abonelik takip kodu. Örn: LIC-M365-001.",
    )

    type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.SUBSCRIPTION,
    )

    vendor = models.CharField(
        max_length=180,
        blank=True,
        help_text="Tedarikçi/üretici. Örn: Microsoft, Adobe, ESET.",
    )

    license_key_masked = models.CharField(
        max_length=120,
        blank=True,
        help_text=(
            "Tam lisans anahtarı tutulmaz. Sadece maskeli değer girilir. "
            "Örn: XXXX-XXXX-1234."
        ),
    )

    seat_count = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )

    assigned_asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name="license_subscriptions",
        null=True,
        blank=True,
        help_text="Bu lisans belirli bir cihaza bağlıysa seçilir.",
    )

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Bitiş/yenileme tarihi. Reminder motoru buradan uyarı üretecek.",
    )

    renewal_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )

    billing_cycle = models.CharField(
        max_length=30,
        choices=BillingCycle.choices,
        default=BillingCycle.YEARLY,
    )

    auto_renew = models.BooleanField(
        default=False,
        help_text="Otomatik yenileniyor mu?",
    )

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_license_subscriptions",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_license_subscriptions",
    )

    class Meta:
        verbose_name = "Lisans / Abonelik"
        verbose_name_plural = "Lisanslar / Abonelikler"
        ordering = ["end_date", "name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["type"]),
            models.Index(fields=["vendor"]),
            models.Index(fields=["end_date"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_deleted"]),
            models.Index(fields=["assigned_asset"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tracking_code"],
                condition=Q(tracking_code__isnull=False) & ~Q(tracking_code=""),
                name="unique_non_empty_license_tracking_code",
            )
        ]

    def __str__(self):
        if self.tracking_code:
            return f"{self.tracking_code} - {self.name}"

        return self.name

    def clean(self):
        if self.assigned_asset and self.assigned_asset.is_deleted:
            raise ValidationError(
                {"assigned_asset": "Silinmiş varlığa lisans bağlanamaz."}
            )

        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError(
                {"end_date": "Bitiş tarihi başlangıç tarihinden önce olamaz."}
            )

        if self.license_key_masked and not has_masking_character(
            self.license_key_masked
        ):
            raise ValidationError(
                {
                    "license_key_masked": (
                        "Tam lisans anahtarı saklama. Maskeli format kullan: "
                        "örn. XXXX-XXXX-1234."
                    )
                }
            )

    def save(self, *args, **kwargs):
        if self.tracking_code == "":
            self.tracking_code = None

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        if not self.end_date:
            return False

        return self.end_date < timezone.localdate()

    @property
    def days_until_end(self):
        if not self.end_date:
            return None

        return (self.end_date - timezone.localdate()).days

    @property
    def is_expiring_soon_30_days(self):
        days = self.days_until_end

        if days is None:
            return False

        return 0 <= days <= 30