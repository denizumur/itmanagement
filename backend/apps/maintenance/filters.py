from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters

from apps.inventory.models import Asset
from apps.maintenance.models import MaintenanceRecord


class MaintenanceRecordFilterSet(filters.FilterSet):
    type = filters.ChoiceFilter(choices=MaintenanceRecord.Type.choices)
    asset = filters.NumberFilter(field_name="asset_id")
    asset_category = filters.NumberFilter(field_name="asset__category_id")
    performed_by = filters.CharFilter(
        field_name="performed_by",
        lookup_expr="icontains",
    )
    asset_status_after = filters.ChoiceFilter(choices=Asset.Status.choices)

    overdue = filters.BooleanFilter(method="filter_overdue")

    performed_before = filters.DateFilter(
        field_name="performed_at",
        lookup_expr="lte",
    )
    performed_after = filters.DateFilter(
        field_name="performed_at",
        lookup_expr="gte",
    )
    next_due_before = filters.DateFilter(
        field_name="next_due_date",
        lookup_expr="lte",
    )
    next_due_after = filters.DateFilter(
        field_name="next_due_date",
        lookup_expr="gte",
    )

    class Meta:
        model = MaintenanceRecord
        fields = [
            "type",
            "asset",
            "asset_category",
            "performed_by",
            "asset_status_after",
            "overdue",
            "performed_before",
            "performed_after",
            "next_due_before",
            "next_due_after",
        ]

    def filter_overdue(self, queryset, name, value):
        today = timezone.localdate()

        if value is True:
            return queryset.filter(next_due_date__lt=today)

        if value is False:
            return queryset.filter(
                Q(next_due_date__isnull=True) | Q(next_due_date__gte=today)
            )

        return queryset