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
        "department",
        "job_title",
        "email",
        "is_active",
        "imported_from_excel",
    )
    list_filter = (
        "is_active",
        "department",
        "job_title",
        "imported_from_excel",
    )
    search_fields = (
        "full_name",
        "employee_code",
        "email",
        "phone",
        "department__name",
        "job_title__name",
    )
    autocomplete_fields = ("department", "job_title")
    ordering = ("full_name",)