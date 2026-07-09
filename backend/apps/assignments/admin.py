from django.contrib import admin
from django.utils import timezone

from apps.assignments.models import Assignment
from apps.inventory.models import Asset


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "asset",
        "employee",
        "assigned_at",
        "returned_at",
        "is_active",
        "assigned_by",
        "returned_by",
    )
    list_filter = (
        "returned_at",
        "asset__category",
        "employee__department",
        "employee__job_title",
    )
    search_fields = (
        "asset__name",
        "asset__inventory_code",
        "asset__serial_number",
        "employee__full_name",
        "employee__employee_code",
        "notes",
        "return_notes",
    )
    autocomplete_fields = ("asset", "employee", "assigned_by", "returned_by")
    readonly_fields = ("created_at", "updated_at")
    actions = ("return_selected_assignments",)

    fieldsets = (
        (
            "Zimmet Bilgisi",
            {
                "fields": (
                    "asset",
                    "employee",
                    "assigned_at",
                    "assigned_by",
                    "notes",
                )
            },
        ),
        (
            "İade Bilgisi",
            {
                "fields": (
                    "returned_at",
                    "returned_by",
                    "return_notes",
                )
            },
        ),
        (
            "Sistem Bilgileri",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.action(description="Seçili aktif zimmetleri iade al")
    def return_selected_assignments(self, request, queryset):
        active_assignments = queryset.filter(returned_at__isnull=True)
        count = 0

        for assignment in active_assignments:
            assignment.returned_at = timezone.now()
            assignment.returned_by = request.user
            assignment.save()

            asset = assignment.asset
            asset.status = Asset.Status.IN_STOCK
            asset.updated_by = request.user
            asset.save(update_fields=["status", "updated_by", "updated_at"])

            count += 1

        self.message_user(request, f"{count} zimmet iade alındı.")