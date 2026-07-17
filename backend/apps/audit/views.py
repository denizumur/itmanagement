from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserProfile
from apps.audit.constants import (
    AUDITED_ENTITY_TYPES,
    CRITICAL_AUDIT_ACTIONS,
    ENTITY_TYPE_LABELS,
)
from apps.audit.filters import AuditLogFilterSet
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogDetailSerializer, AuditLogListSerializer
from apps.common.pagination import StandardResultsPagination

class IsAdminRole(BasePermission):
    message = "Audit log görüntüleme yetkisi yalnızca Admin rolüne açıktır."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if getattr(user, "is_superuser", False):
            return True

        return UserProfile.objects.filter(
            user=user,
            role=UserProfile.Role.ADMIN,
        ).exists()

def audit_log_queryset():
    return AuditLog.objects.select_related(
        "actor",
        "actor__profile",
    ).order_by("-created_at")


class AuditLogListAPIView(ListAPIView):
    serializer_class = AuditLogListSerializer
    permission_classes = [IsAdminRole]
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = AuditLogFilterSet

    search_fields = [
        "entity_repr",
        "entity_type",
        "entity_id",
        "actor__username",
        "actor__first_name",
        "actor__last_name",
        "actor__email",
        "request_path",
    ]

    ordering_fields = [
        "created_at",
        "action",
        "entity_type",
        "entity_id",
        "actor__username",
        "actor_id",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):
        return audit_log_queryset()


class AuditLogDetailAPIView(RetrieveAPIView):
    serializer_class = AuditLogDetailSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        return audit_log_queryset()


class AuditLogSummaryAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = audit_log_queryset()

        total = queryset.count()

        entity_counts = {
            row["entity_type"]: row["count"]
            for row in queryset.values("entity_type").annotate(count=Count("id"))
        }

        by_entity_type = []

        for entity_type, label in AUDITED_ENTITY_TYPES:
            by_entity_type.append(
                {
                    "entity_type": entity_type,
                    "label": label,
                    "count": entity_counts.pop(entity_type, 0),
                }
            )

        for entity_type, count in sorted(entity_counts.items()):
            by_entity_type.append(
                {
                    "entity_type": entity_type,
                    "label": ENTITY_TYPE_LABELS.get(entity_type, entity_type),
                    "count": count,
                }
            )

        action_counts = {
            row["action"]: row["count"]
            for row in queryset.values("action").annotate(count=Count("id"))
        }

        critical = {
            "delete": action_counts.get(AuditLog.Action.DELETE, 0),
            "restore": action_counts.get(AuditLog.Action.RESTORE, 0),
            "export": action_counts.get(AuditLog.Action.EXPORT, 0),
            "dispose": action_counts.get(AuditLog.Action.DISPOSE, 0),
            "cancel": action_counts.get("cancel", 0),
        }
        critical["total"] = sum(critical.values())

        return Response(
            {
                "total": total,
                "by_entity_type": by_entity_type,
                "by_action": action_counts,
                "critical": critical,
                "critical_actions": CRITICAL_AUDIT_ACTIONS,
            }
        )