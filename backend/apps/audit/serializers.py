from rest_framework import serializers

from apps.audit.constants import CRITICAL_AUDIT_ACTIONS, ENTITY_TYPE_LABELS
from apps.audit.models import AuditLog


def get_user_display_name(user):
    if not user:
        return "Sistem"

    full_name = user.get_full_name()

    return full_name or user.username or str(user)


class AuditLogListSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    entity_type_label = serializers.SerializerMethodField()
    module = serializers.SerializerMethodField()
    operation = serializers.SerializerMethodField()
    has_changes = serializers.SerializerMethodField()
    changes_count = serializers.SerializerMethodField()
    is_critical = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "actor_username",
            "action",
            "action_label",
            "entity_type",
            "entity_type_label",
            "entity_id",
            "entity_repr",
            "module",
            "operation",
            "request_method",
            "request_path",
            "ip_address",
            "created_at",
            "has_changes",
            "changes_count",
            "is_critical",
        ]

    def get_actor_name(self, audit_log):
        return get_user_display_name(audit_log.actor)

    def get_entity_type_label(self, audit_log):
        return ENTITY_TYPE_LABELS.get(audit_log.entity_type, audit_log.entity_type)

    def get_module(self, audit_log):
        metadata = audit_log.metadata or {}

        if not isinstance(metadata, dict):
            return ""

        return metadata.get("module", "")

    def get_operation(self, audit_log):
        metadata = audit_log.metadata or {}

        if not isinstance(metadata, dict):
            return ""

        return metadata.get("operation", "")

    def get_has_changes(self, audit_log):
        return bool(audit_log.changes)

    def get_changes_count(self, audit_log):
        if not isinstance(audit_log.changes, dict):
            return 0

        return len(audit_log.changes)

    def get_is_critical(self, audit_log):
        return audit_log.action in CRITICAL_AUDIT_ACTIONS


class AuditLogDetailSerializer(AuditLogListSerializer):
    class Meta(AuditLogListSerializer.Meta):
        fields = AuditLogListSerializer.Meta.fields + [
            "before",
            "after",
            "changes",
            "metadata",
            "user_agent",
        ]