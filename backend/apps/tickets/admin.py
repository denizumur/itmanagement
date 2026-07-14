from django.contrib import admin

from apps.tickets.models import Ticket, TicketComment


class TicketCommentInline(admin.TabularInline):
    model = TicketComment
    extra = 0
    readonly_fields = ("author", "created_at")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "employee",
        "category",
        "priority",
        "approval_status",
        "status",
        "assigned_to",
        "created_at",
    )
    list_filter = (
        "status",
        "priority",
        "category",
        "approval_status",
        "created_at",
    )
    search_fields = (
        "title",
        "description",
        "employee__full_name",
        "employee__email",
        "assigned_to__username",
        "created_by__username",
    )
    autocomplete_fields = (
        "employee",
        "asset",
        "assigned_to",
        "created_by",
    )
    readonly_fields = ("created_at", "updated_at", "resolved_at", "closed_at")
    inlines = [TicketCommentInline]


@admin.register(TicketComment)
class TicketCommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "is_internal", "created_at")
    list_filter = ("is_internal", "created_at")
    search_fields = ("ticket__title", "body", "author__username")
    autocomplete_fields = ("ticket", "author")
    readonly_fields = ("created_at",)