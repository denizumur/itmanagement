from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import TimeStampedModel
from apps.employees.models import Employee
from apps.inventory.models import Asset


class Assignment(TimeStampedModel):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="assignments",
    )

    assigned_at = models.DateTimeField(default=timezone.now)
    returned_at = models.DateTimeField(null=True, blank=True)

    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assignments",
    )
    returned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="returned_assignments",
    )

    notes = models.TextField(blank=True)
    return_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Zimmet"
        verbose_name_plural = "Zimmetler"
        ordering = ["-assigned_at"]
        indexes = [
            models.Index(fields=["asset"]),
            models.Index(fields=["employee"]),
            models.Index(fields=["assigned_at"]),
            models.Index(fields=["returned_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["asset"],
                condition=Q(returned_at__isnull=True),
                name="unique_active_assignment_per_asset",
            )
        ]

    def __str__(self):
        return f"{self.asset} → {self.employee}"

    @property
    def is_active(self):
        return self.returned_at is None

    def clean(self):
        if self.asset and self.asset.is_deleted:
            raise ValidationError({"asset": "Silinmiş varlık zimmetlenemez."})

        if self.employee and not self.employee.is_active:
            raise ValidationError({"employee": "Pasif personele zimmet yapılamaz."})

        if self.returned_at and self.returned_at < self.assigned_at:
            raise ValidationError(
                {"returned_at": "İade tarihi zimmet tarihinden önce olamaz."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)