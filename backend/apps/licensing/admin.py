from django.contrib import admin
from django.utils import timezone

from apps.licensing.models import LicenseSubscription


@admin.register(LicenseSubscription)
class LicenseSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "tracking_code",
        "name",
        "type",
        "vendor",
        "seat_count",
        "assigned_asset",
        "end_date",
        "is_expired",
        "auto_renew",
        "renewal_cost",
        "is_active",
        "is_deleted",
    )
    list_filter = (
        "type",
        "vendor",
        "auto_renew",
        "is_active",
        "is_deleted",
        "billing_cycle",
    )
    search_fields = (
        "tracking_code",
        "name",
        "vendor",
        "license_key_masked",
        "assigned_asset__name",
        "assigned_asset__inventory_code",
        "notes",
    )
    autocomplete_fields = ("assigned_asset", "created_by", "updated_by")
    readonly_fields = (
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by",
        "updated_by",
    )
    actions = ("soft_delete_selected", "restore_selected")

    fieldsets = (
        (
            "Temel Bilgiler",
            {
                "fields": (
                    "name",
                    "tracking_code",
                    "type",
                    "vendor",
                    "license_key_masked",
                    "seat_count",
                    "assigned_asset",
                )
            },
        ),
        (
            "Tarih / Yenileme",
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "renewal_cost",
                    "billing_cycle",
                    "auto_renew",
                )
            },
        ),
        (
            "Durum / Not",
            {
                "fields": (
                    "is_active",
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
        return LicenseSubscription.all_objects.select_related(
            "assigned_asset",
            "created_by",
            "updated_by",
        )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user

        obj.updated_by = request.user

        super().save_model(request, obj, form, change)

    @admin.action(description="Seçili lisans/abonelikleri soft delete yap")
    def soft_delete_selected(self, request, queryset):
        updated_count = queryset.update(
            is_deleted=True,
            deleted_at=timezone.now(),
            updated_by=request.user,
        )

        self.message_user(
            request,
            f"{updated_count} lisans/abonelik soft delete yapıldı.",
        )

    @admin.action(description="Seçili lisans/abonelikleri geri yükle")
    def restore_selected(self, request, queryset):
        updated_count = queryset.update(
            is_deleted=False,
            deleted_at=None,
            updated_by=request.user,
        )

        self.message_user(
            request,
            f"{updated_count} lisans/abonelik geri yüklendi.",
        )