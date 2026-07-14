from django.contrib import admin

from apps.tickets.models import Ticket, TicketApproval, TicketComment


class TicketCommentInline(admin.TabularInline):
    model = TicketComment
    extra = 0
    readonly_fields = ("author", "created_at")


class TicketApprovalInline(admin.TabularInline):
    model = TicketApproval
    extra = 0
    readonly_fields = ("requested_at", "decided_at", "created_at", "updated_at")
    autocomplete_fields = ("approver", "approver_user", "requested_by")


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
    inlines = [TicketApprovalInline, TicketCommentInline]


@admin.register(TicketApproval)
class TicketApprovalAdmin(admin.ModelAdmin):
    list_display = (
        "ticket",
        "approver",
        "approver_user",
        "status",
        "requested_at",
        "decided_at",
    )
    list_filter = ("status", "requested_at", "decided_at")
    search_fields = (
        "ticket__title",
        "approver__full_name",
        "approver_user__username",
        "requested_by__username",
        "decision_note",
    )
    autocomplete_fields = (
        "ticket",
        "approver",
        "approver_user",
        "requested_by",
    )
    readonly_fields = ("requested_at", "decided_at", "created_at", "updated_at")


@admin.register(TicketComment)
class TicketCommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "is_internal", "created_at")
    list_filter = ("is_internal", "created_at")
    search_fields = ("ticket__title", "body", "author__username")
    autocomplete_fields = ("ticket", "author")
    readonly_fields = ("created_at",)