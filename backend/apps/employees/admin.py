from django.contrib import admin

from apps.employees.models import Department, Employee, JobTitle


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "display_order", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("display_order", "name")


@admin.register(JobTitle)
class JobTitleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "display_order", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("display_order", "name")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "employee_code",
        "user",
        "manager",
        "department",
        "job_title",
        "email",
        "sync_source",
        "is_active",
        "imported_from_excel",
    )
    list_filter = (
        "is_active",
        "sync_source",
        "department",
        "job_title",
        "imported_from_excel",
    )
    search_fields = (
        "full_name",
        "employee_code",
        "email",
        "phone",
        "external_hr_id",
        "user__username",
        "user__email",
        "manager__full_name",
        "department__name",
        "job_title__name",
    )
    autocomplete_fields = (
        "user",
        "manager",
        "department",
        "job_title",
    )
    readonly_fields = ("created_at", "updated_at")
    ordering = ("full_name",)