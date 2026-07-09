from django.contrib import admin
from django.utils import timezone

from apps.inventory.models import Asset
from apps.maintenance.models import MaintenanceRecord


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = (
        "asset",
        "type",
        "performed_at",
        "next_due_date",
        "is_overdue",
        "cost",
        "performed_by",
        "created_by",
    )
    list_filter = (
        "type",
        "performed_at",
        "next_due_date",
        "asset__category",
        "asset_status_after",
    )
    search_fields = (
        "asset__name",
        "asset__inventory_code",
        "asset__serial_number",
        "performed_by",
        "description",
    )
    autocomplete_fields = ("asset", "created_by", "updated_by")
    readonly_fields = (
        "asset_status_before",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )

    fieldsets = (
        (
            "İşlem Bilgisi",
            {
                "fields": (
                    "asset",
                    "type",
                    "performed_at",
                    "performed_by",
                    "description",
                    "cost",
                )
            },
        ),
        (
            "Periyodik Bakım",
            {
                "fields": (
                    "frequency_days",
                    "next_due_date",
                )
            },
        ),
        (
            "Varlık Durumu",
            {
                "fields": (
                    "asset_status_before",
                    "asset_status_after",
                )
            },
        ),
        (
            "Sistem Bilgileri",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        asset = obj.asset

        if not change:
            obj.created_by = request.user
            obj.asset_status_before = asset.status

        obj.updated_by = request.user

        super().save_model(request, obj, form, change)

        self.apply_asset_effect(obj, request.user)

    def apply_asset_effect(self, record, user):
        asset = record.asset
        update_fields = ["updated_by", "updated_at"]

        asset.updated_by = user

        if record.type == MaintenanceRecord.Type.MAINTENANCE:
            asset.maintenance_enabled = True

            if record.frequency_days:
                asset.maintenance_frequency_days = record.frequency_days
                update_fields.append("maintenance_frequency_days")

            if record.next_due_date:
                asset.next_maintenance_due_date = record.next_due_date
                update_fields.append("next_maintenance_due_date")

            update_fields.append("maintenance_enabled")

            if record.asset_status_after:
                asset.status = record.asset_status_after
                update_fields.append("status")

        elif record.type == MaintenanceRecord.Type.REPAIR:
            if record.asset_status_after:
                asset.status = record.asset_status_after
            else:
                has_active_assignment = asset.assignments.filter(
                    returned_at__isnull=True
                ).exists()
                asset.status = (
                    Asset.Status.ASSIGNED
                    if has_active_assignment
                    else Asset.Status.ACTIVE
                )

            update_fields.append("status")

        elif record.type == MaintenanceRecord.Type.DISPOSAL:
            asset.status = Asset.Status.DISPOSED
            asset.maintenance_enabled = False
            asset.next_maintenance_due_date = None

            update_fields.extend(
                [
                    "status",
                    "maintenance_enabled",
                    "next_maintenance_due_date",
                ]
            )

        asset.save(update_fields=list(set(update_fields)))