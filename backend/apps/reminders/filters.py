from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters

from apps.reminders.models import Reminder


def not_snoozed_today_filter(today):
    return Q(snoozed_until__isnull=True) | Q(snoozed_until__lt=today)


class ReminderFilterSet(filters.FilterSet):
    source_type = filters.ChoiceFilter(choices=Reminder.SourceType.choices)
    status = filters.ChoiceFilter(choices=Reminder.Status.choices)
    channel = filters.ChoiceFilter(choices=Reminder.Channel.choices)

    source_id = filters.NumberFilter(field_name="source_id")
    threshold_days = filters.NumberFilter(field_name="threshold_days")
    created_by = filters.NumberFilter(field_name="created_by_id")

    visible = filters.CharFilter(method="filter_visible")
    snoozed_today = filters.BooleanFilter(method="filter_snoozed_today")
    time_status = filters.CharFilter(method="filter_time_status")

    due_before = filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due_after = filters.DateFilter(field_name="due_date", lookup_expr="gte")
    scheduled_before = filters.DateFilter(
        field_name="scheduled_for",
        lookup_expr="lte",
    )
    scheduled_after = filters.DateFilter(
        field_name="scheduled_for",
        lookup_expr="gte",
    )

    class Meta:
        model = Reminder
        fields = [
            "source_type",
            "status",
            "channel",
            "source_id",
            "threshold_days",
            "created_by",
            "visible",
            "snoozed_today",
            "time_status",
            "due_before",
            "due_after",
            "scheduled_before",
            "scheduled_after",
        ]

    def filter_visible(self, queryset, name, value):
        if value != "true":
            return queryset

        today = timezone.localdate()

        return queryset.filter(
            scheduled_for__lte=today,
            status=Reminder.Status.PENDING,
        ).filter(not_snoozed_today_filter(today))

    def filter_snoozed_today(self, queryset, name, value):
        today = timezone.localdate()

        if value is True:
            return queryset.filter(
                status=Reminder.Status.PENDING,
                snoozed_until__gte=today,
            )

        if value is False:
            return queryset.filter(
                Q(snoozed_until__isnull=True) | Q(snoozed_until__lt=today)
            )

        return queryset

    def filter_time_status(self, queryset, name, value):
        today = timezone.localdate()

        if not value:
            return queryset

        if value == "snoozed_today":
            return queryset.filter(
                status=Reminder.Status.PENDING,
                snoozed_until__gte=today,
            )

        queryset = queryset.filter(status=Reminder.Status.PENDING).filter(
            not_snoozed_today_filter(today)
        )

        if value == "overdue":
            return queryset.filter(due_date__lt=today)

        if value == "today":
            return queryset.filter(due_date=today)

        if value == "next_7_days":
            return queryset.filter(
                due_date__gt=today,
                due_date__lte=today + timezone.timedelta(days=7),
            )

        if value == "next_30_days":
            return queryset.filter(
                due_date__gt=today + timezone.timedelta(days=7),
                due_date__lte=today + timezone.timedelta(days=30),
            )

        if value == "future":
            return queryset.filter(due_date__gt=today + timezone.timedelta(days=30))

        return queryset