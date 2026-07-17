from django.db.models import Count, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from apps.accounts.permissions import ReadOnlyForViewerWriteForTechnician
from apps.common.pagination import StandardResultsPagination
from apps.reminders.filters import ReminderFilterSet
from apps.reminders.models import Reminder
from apps.reminders.serializers import ReminderGenerateSerializer, ReminderSerializer
from apps.reminders.services import ReminderGenerationService
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)


def not_snoozed_today_filter(today):
    return Q(snoozed_until__isnull=True) | Q(snoozed_until__lt=today)


def reminder_base_queryset():
    return Reminder.objects.select_related("created_by")


class ReminderTableListAPIView(ListAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = ReminderFilterSet

    search_fields = [
        "title",
        "message",
        "created_by__username",
    ]

    ordering_fields = [
        "source_type",
        "source_id",
        "title",
        "due_date",
        "scheduled_for",
        "threshold_days",
        "channel",
        "status",
        "created_at",
        "updated_at",
    ]

    ordering = ["scheduled_for", "due_date", "threshold_days"]

    def get_queryset(self):
        return reminder_base_queryset().order_by(
            "scheduled_for",
            "due_date",
            "threshold_days",
        )


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="source_type",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Kaynak tipi: warranty, maintenance, license, ticket_sla",
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Durum: pending, sent, dismissed, cancelled",
            ),
            OpenApiParameter(
                name="channel",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Kanal: in_app, email",
            ),
            OpenApiParameter(
                name="visible",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description=(
                    "true verilirse bugün gösterilmesi gereken ve bugün gizlenmemiş "
                    "pending hatırlatıcıları getirir."
                ),
            ),
            OpenApiParameter(
                name="due_before",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Bu tarihe kadar due_date filtresi. Örn: 2026-07-31",
            ),
            OpenApiParameter(
                name="due_after",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Bu tarihten sonraki due_date filtresi. Örn: 2026-07-01",
            ),
        ]
    )
)
class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]

    def get_queryset(self):
        queryset = reminder_base_queryset().order_by(
            "scheduled_for",
            "due_date",
            "threshold_days",
        )

        source_type = self.request.query_params.get("source_type")
        status_value = self.request.query_params.get("status")
        channel = self.request.query_params.get("channel")
        visible = self.request.query_params.get("visible")
        due_before = self.request.query_params.get("due_before")
        due_after = self.request.query_params.get("due_after")

        if source_type:
            queryset = queryset.filter(source_type=source_type)

        if status_value:
            queryset = queryset.filter(status=status_value)

        if channel:
            queryset = queryset.filter(channel=channel)

        if visible == "true":
            today = timezone.localdate()

            queryset = queryset.filter(
                scheduled_for__lte=today,
                status=Reminder.Status.PENDING,
            ).filter(not_snoozed_today_filter(today))

        if due_before:
            queryset = queryset.filter(due_date__lte=due_before)

        if due_after:
            queryset = queryset.filter(due_date__gte=due_after)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        reminder = self.get_object()
        reminder.cancel()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"])
    def generate(self, request):
        serializer = ReminderGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        channel = serializer.validated_data["channel"]

        service = ReminderGenerationService()
        result = service.generate_all(
            channel=channel,
            created_by=request.user,
        )

        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        today = timezone.localdate()

        visible_pending_queryset = queryset.filter(
            status=Reminder.Status.PENDING,
            scheduled_for__lte=today,
        ).filter(not_snoozed_today_filter(today))

        data = {
            "total": queryset.count(),
            "pending": queryset.filter(status=Reminder.Status.PENDING).count(),
            "sent": queryset.filter(status=Reminder.Status.SENT).count(),
            "dismissed": queryset.filter(status=Reminder.Status.DISMISSED).count(),
            "cancelled": queryset.filter(status=Reminder.Status.CANCELLED).count(),
            "visible_pending": visible_pending_queryset.count(),
            "snoozed_today": queryset.filter(
                status=Reminder.Status.PENDING,
                snoozed_until__gte=today,
            ).count(),
            "overdue_due_date": visible_pending_queryset.filter(
                due_date__lt=today,
            ).count(),
            "due_today": visible_pending_queryset.filter(
                due_date=today,
            ).count(),
            "upcoming_7_days": visible_pending_queryset.filter(
                due_date__gt=today,
                due_date__lte=today + timezone.timedelta(days=7),
            ).count(),
            "upcoming_30_days": visible_pending_queryset.filter(
                due_date__gt=today + timezone.timedelta(days=7),
                due_date__lte=today + timezone.timedelta(days=30),
            ).count(),
            "by_source_type": list(
                queryset.values("source_type")
                .annotate(count=Count("id"))
                .order_by("source_type")
            ),
            "by_status": list(
                queryset.values("status").annotate(count=Count("id")).order_by("status")
            ),
            "by_channel": list(
                queryset.values("channel")
                .annotate(count=Count("id"))
                .order_by("channel")
            ),
        }

        return Response(data)

    @action(detail=True, methods=["post"])
    def mark_sent(self, request, pk=None):
        reminder = self.get_object()
        reminder.mark_sent()

        serializer = self.get_serializer(reminder)

        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        reminder = self.get_object()
        reminder.dismiss()

        serializer = self.get_serializer(reminder)

        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def snooze_today(self, request, pk=None):
        reminder = self.get_object()
        reminder.snooze_today()

        serializer = self.get_serializer(reminder)

        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reminder = self.get_object()
        reminder.cancel()

        serializer = self.get_serializer(reminder)

        return Response(serializer.data)