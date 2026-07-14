from django.conf import settings
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Departman"
        verbose_name_plural = "Departmanlar"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class JobTitle(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Meslek / Görev"
        verbose_name_plural = "Meslekler / Görevler"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class Employee(models.Model):
    class SyncSource(models.TextChoices):
        MANUAL = "manual", "Manual"
        EXCEL = "excel", "Excel"
        HR_API = "hr_api", "HR API"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="employee_profile",
        null=True,
        blank=True,
        help_text="Bu personelle eşleşen sistem kullanıcısı.",
    )

    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="direct_reports",
        null=True,
        blank=True,
        help_text="Personelin bağlı olduğu amir/yönetici.",
    )

    full_name = models.CharField(max_length=180)

    employee_code = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        help_text="Varsa şirket içi personel numarası.",
    )

    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="employees",
        null=True,
        blank=True,
    )

    job_title = models.ForeignKey(
        JobTitle,
        on_delete=models.PROTECT,
        related_name="employees",
        null=True,
        blank=True,
    )

    external_hr_id = models.CharField(
        max_length=120,
        blank=True,
        help_text="İleride HR sistemiyle eşleşme için harici personel ID.",
    )
    sync_source = models.CharField(
        max_length=20,
        choices=SyncSource.choices,
        default=SyncSource.MANUAL,
        help_text="Personel kaydının ana kaynağı.",
    )

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    imported_from_excel = models.BooleanField(default=False)
    import_batch_id = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Personel"
        verbose_name_plural = "Personeller"
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["full_name"]),
            models.Index(fields=["email"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["external_hr_id"]),
            models.Index(fields=["sync_source"]),
        ]

    def __str__(self):
        if self.department:
            return f"{self.full_name} - {self.department.name}"

        return self.full_name