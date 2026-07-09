from django.contrib import admin
from django.utils import timezone

from apps.inventory.models import Asset, AssetCategory


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "is_active",
        "display_order",
        "created_at",
        "updated_at",
    )
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    ordering = ("display_order", "name")


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = (
        "display_identifier",
        "name",
        "category",
        "brand",
        "model",
        "status",
        "location",
        "warranty_end_date",
        "maintenance_enabled",
        "next_maintenance_due_date",
        "is_deleted",
    )
    list_filter = (
        "status",
        "category",
        "maintenance_enabled",
        "is_deleted",
        "location",
    )
    search_fields = (
        "name",
        "brand",
        "model",
        "serial_number",
        "inventory_code",
        "location",
        "ip_address",
        "mac_address",
        "vendor_name",
        "notes",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by",
        "updated_by",
    )
    autocomplete_fields = ("category",)
    actions = ("soft_delete_selected", "restore_selected")

    fieldsets = (
        (
            "Temel Bilgiler",
            {
                "fields": (
                    "category",
                    "name",
                    "brand",
                    "model",
                    "serial_number",
                    "inventory_code",
                    "status",
                    "location",
                )
            },
        ),
        (
            "Ağ Bilgileri",
            {
                "fields": (
                    "ip_address",
                    "mac_address",
                )
            },
        ),
        (
            "Satın Alma / Garanti",
            {
                "fields": (
                    "purchase_date",
                    "purchase_price",
                    "vendor_name",
                    "warranty_end_date",
                )
            },
        ),
        (
            "Bakım Takibi",
            {
                "fields": (
                    "maintenance_enabled",
                    "maintenance_frequency_days",
                    "next_maintenance_due_date",
                )
            },
        ),
        (
            "Ek Bilgiler",
            {
                "fields": (
                    "custom_fields",
                    "notes",
                )
            },
        ),
        (
            "Sistem Bilgileri",
            {
                "fields": (
                    "is_deleted",
                    "deleted_at",
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_queryset(self, request):
        return Asset.all_objects.select_related(
            "category",
            "created_by",
            "updated_by",
        )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user

        obj.updated_by = request.user

        super().save_model(request, obj, form, change)

    @admin.action(description="Seçili varlıkları soft delete yap")
    def soft_delete_selected(self, request, queryset):
        updated_count = queryset.update(
            is_deleted=True,
            deleted_at=timezone.now(),
            updated_by=request.user,
        )

        self.message_user(
            request,
            f"{updated_count} varlık soft delete yapıldı.",
        )

    @admin.action(description="Seçili varlıkları geri yükle")
    def restore_selected(self, request, queryset):
        updated_count = queryset.update(
            is_deleted=False,
            deleted_at=None,
            updated_by=request.user,
        )

        self.message_user(
            request,
            f"{updated_count} varlık geri yüklendi.",
        )