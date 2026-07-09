from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import ReadOnlyForViewerWriteForTechnician
from apps.reminders.models import Reminder
from apps.reminders.serializers import ReminderGenerateSerializer, ReminderSerializer
from apps.reminders.services import ReminderGenerationService
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
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
                description="true verilirse bugün gösterilmesi gereken pending hatırlatıcıları getirir.",
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
        queryset = Reminder.objects.select_related("created_by").order_by(
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
            queryset = queryset.filter(
                scheduled_for__lte=timezone.localdate(),
                status=Reminder.Status.PENDING,
            )

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

        data = {
            "total": queryset.count(),
            "pending": queryset.filter(status=Reminder.Status.PENDING).count(),
            "visible_pending": queryset.filter(
                status=Reminder.Status.PENDING,
                scheduled_for__lte=today,
            ).count(),
            "sent": queryset.filter(status=Reminder.Status.SENT).count(),
            "dismissed": queryset.filter(status=Reminder.Status.DISMISSED).count(),
            "cancelled": queryset.filter(status=Reminder.Status.CANCELLED).count(),
            "overdue_due_date": queryset.filter(
                status=Reminder.Status.PENDING,
                due_date__lt=today,
            ).count(),
            "due_today": queryset.filter(
                status=Reminder.Status.PENDING,
                due_date=today,
            ).count(),
            "upcoming_7_days": queryset.filter(
                status=Reminder.Status.PENDING,
                due_date__gte=today,
                due_date__lte=today + timezone.timedelta(days=7),
            ).count(),
            "upcoming_30_days": queryset.filter(
                status=Reminder.Status.PENDING,
                due_date__gte=today,
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
    def cancel(self, request, pk=None):
        reminder = self.get_object()
        reminder.cancel()

        serializer = self.get_serializer(reminder)

        return Response(serializer.data)