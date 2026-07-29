from django.conf import settings
from django.db import models
from django.utils import timezone


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


class EmployeeImportJob(models.Model):
    class Status(models.TextChoices):
        DRY_RUN = "dry_run", "Dry-run"
        COMMITTED = "committed", "Committed"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"

    import_id = models.CharField(max_length=100, unique=True, db_index=True)
    file_name = models.CharField(max_length=255)
    file_format = models.CharField(max_length=10)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRY_RUN,
        db_index=True,
    )
    mode = models.CharField(max_length=30, default="create_only")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_import_jobs",
    )
    total_rows = models.PositiveIntegerField(default=0)
    valid_rows = models.PositiveIntegerField(default=0)
    error_rows = models.PositiveIntegerField(default=0)
    warning_rows = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    created_department_count = models.PositiveIntegerField(default=0)
    created_job_title_count = models.PositiveIntegerField(default=0)
    created_user_count = models.PositiveIntegerField(default=0)
    linked_user_count = models.PositiveIntegerField(default=0)
    file_size = models.PositiveIntegerField(default=0)
    unknown_headers = models.JSONField(default=list, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    committed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
        ]

    def __str__(self):
        return f"{self.file_name} ({self.status})"
