from django.contrib import admin

from apps.accounts.models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "department",
        "phone",
        "created_at",
        "updated_at",
    )
    list_filter = (
        "role",
        "department",
        "created_at",
    )
    search_fields = (
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "department",
        "phone",
    )
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")