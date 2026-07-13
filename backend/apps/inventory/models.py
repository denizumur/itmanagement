from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import SoftDeleteModel, TimeStampedModel


class AssetCategory(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)

    custom_fields_schema = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Kategoriye özel alan şeması. Örn: laptop için cpu/ram/disk, "
            "yazıcı için toner_model/connection_type."
        ),
    )

    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Varlık Kategorisi"
        verbose_name_plural = "Varlık Kategorileri"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class Asset(TimeStampedModel, SoftDeleteModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Aktif"
        ASSIGNED = "assigned", "Zimmetli"
        IN_STOCK = "in_stock", "Depoda / Boşta"
        IN_REPAIR = "in_repair", "Bakımda / Onarımda"
        FAULTY = "faulty", "Arızalı"
        RETIRED = "retired", "Emekli"
        DISPOSED = "disposed", "İmha Edildi"
        LOST = "lost", "Kayıp"

    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.PROTECT,
        related_name="assets",
    )

    name = models.CharField(
        max_length=180,
        help_text="Örn: Bilgi İşlem Laptop 01, Muhasebe Yazıcı 02.",
    )

    brand = models.CharField(max_length=120, blank=True)
    model = models.CharField(max_length=120, blank=True)

    serial_number = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        help_text="Üretici seri numarası. Boş bırakılabilir ama varsa benzersiz olmalı.",
    )

    inventory_code = models.CharField(
        max_length=80,
        null=True,
        blank=True,
        help_text="Şirket içi envanter kodu. Örn: IT-LPT-0001.",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    location = models.CharField(
        max_length=180,
        blank=True,
        help_text="Örn: Genel Müdürlük, Depo, Mağaza 1, Bilgi İşlem Odası.",
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Yazıcı, sunucu, switch gibi ağ cihazları için.",
    )

    mac_address = models.CharField(
        max_length=50,
        blank=True,
        help_text="Opsiyonel MAC adresi.",
    )

    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    vendor_name = models.CharField(
        max_length=180,
        blank=True,
        help_text="Tedarikçi adı. İleride Vendor tablosuna bağlanabilir.",
    )

    warranty_end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Garanti bitiş tarihi. Reminder motoru buradan uyarı üretecek.",
    )

    maintenance_enabled = models.BooleanField(
        default=False,
        help_text="Bu varlık için periyodik bakım takibi aktif mi?",
    )

    maintenance_frequency_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Bakım sıklığı. Örn: 90 gün.",
    )

    next_maintenance_due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Sonraki bakım tarihi. Dashboard ve reminder için kullanılır.",
    )

    custom_fields = models.JSONField(
        default=dict,
        blank=True,
        help_text="Kategoriye özel esnek bilgiler. Örn: cpu, ram, disk, toner_model.",
    )

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assets",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_assets",
    )

    class Meta:
        verbose_name = "Varlık"
        verbose_name_plural = "Varlıklar"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["status"]),
            models.Index(fields=["category"]),
            models.Index(fields=["serial_number"]),
            models.Index(fields=["inventory_code"]),
            models.Index(fields=["warranty_end_date"]),
            models.Index(fields=["next_maintenance_due_date"]),
            models.Index(fields=["is_deleted"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["serial_number"],
                condition=(
                    Q(is_deleted=False)
                    & Q(serial_number__isnull=False)
                    & ~Q(serial_number="")
                ),
                name="unique_active_asset_serial_number",
            ),
            models.UniqueConstraint(
                fields=["inventory_code"],
                condition=(
                    Q(is_deleted=False)
                    & Q(inventory_code__isnull=False)
                    & ~Q(inventory_code="")
                ),
                name="unique_active_asset_inventory_code",
            ),
        ]

    def __str__(self):
        if self.inventory_code:
            return f"{self.inventory_code} - {self.name}"

        return self.name

    def clean(self):
        if self.maintenance_enabled and not self.maintenance_frequency_days:
            raise ValidationError(
                {
                    "maintenance_frequency_days": (
                        "Bakım takibi aktifse bakım sıklığı girilmelidir."
                    )
                }
            )

        if self.purchase_date and self.warranty_end_date:
            if self.warranty_end_date < self.purchase_date:
                raise ValidationError(
                    {
                        "warranty_end_date": (
                            "Garanti bitiş tarihi satın alma tarihinden önce olamaz."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        if isinstance(self.serial_number, str):
            self.serial_number = self.serial_number.strip() or None

        if isinstance(self.inventory_code, str):
            self.inventory_code = self.inventory_code.strip() or None

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_warranty_expired(self):
        if not self.warranty_end_date:
            return False

        return self.warranty_end_date < timezone.localdate()

    @property
    def is_maintenance_overdue(self):
        if not self.maintenance_enabled or not self.next_maintenance_due_date:
            return False

        return self.next_maintenance_due_date < timezone.localdate()

    @property
    def display_identifier(self):
        if self.inventory_code:
            return self.inventory_code

        if self.serial_number:
            return self.serial_number

        return f"ASSET-{self.id}"