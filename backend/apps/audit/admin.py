from django.contrib import admin

from apps.audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "actor",
        "action",
        "entity_type",
        "entity_id",
        "entity_repr",
        "ip_address",
    )

    list_filter = (
        "action",
        "entity_type",
        "created_at",
    )

    search_fields = (
        "actor__username",
        "actor__email",
        "entity_type",
        "entity_id",
        "entity_repr",
        "request_path",
        "ip_address",
    )

    readonly_fields = (
        "actor",
        "action",
        "entity_type",
        "entity_id",
        "entity_repr",
        "before",
        "after",
        "changes",
        "request_method",
        "request_path",
        "ip_address",
        "user_agent",
        "metadata",
        "created_at",
    )

    fieldsets = (
        (
            "İşlem Bilgisi",
            {
                "fields": (
                    "actor",
                    "action",
                    "created_at",
                )
            },
        ),
        (
            "Hedef Kayıt",
            {
                "fields": (
                    "entity_type",
                    "entity_id",
                    "entity_repr",
                )
            },
        ),
        (
            "Değişiklik Verisi",
            {
                "fields": (
                    "before",
                    "after",
                    "changes",
                )
            },
        ),
        (
            "İstek Bilgisi",
            {
                "fields": (
                    "request_method",
                    "request_path",
                    "ip_address",
                    "user_agent",
                )
            },
        ),
        (
            "Ek Bilgi",
            {
                "fields": (
                    "metadata",
                )
            },
        ),
    )

    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False