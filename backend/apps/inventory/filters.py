from django.utils import timezone
from django_filters import rest_framework as filters

from apps.inventory.models import Asset


class AssetFilterSet(filters.FilterSet):
    status = filters.ChoiceFilter(choices=Asset.Status.choices)
    category = filters.NumberFilter(field_name="category_id")
    location = filters.CharFilter(field_name="location", lookup_expr="icontains")

    warranty_end_before = filters.DateFilter(
        field_name="warranty_end_date",
        lookup_expr="lte",
    )
    warranty_end_after = filters.DateFilter(
        field_name="warranty_end_date",
        lookup_expr="gte",
    )

    next_maintenance_before = filters.DateFilter(
        field_name="next_maintenance_due_date",
        lookup_expr="lte",
    )
    next_maintenance_after = filters.DateFilter(
        field_name="next_maintenance_due_date",
        lookup_expr="gte",
    )

    maintenance_overdue = filters.BooleanFilter(method="filter_maintenance_overdue")
    warranty_expired = filters.BooleanFilter(method="filter_warranty_expired")

    class Meta:
        model = Asset
        fields = [
            "status",
            "category",
            "location",
            "warranty_end_before",
            "warranty_end_after",
            "next_maintenance_before",
            "next_maintenance_after",
            "maintenance_overdue",
            "warranty_expired",
        ]

    def filter_maintenance_overdue(self, queryset, name, value):
        if value is True:
            return queryset.filter(
                maintenance_enabled=True,
                next_maintenance_due_date__lt=timezone.localdate(),
            )

        if value is False:
            return queryset.exclude(
                maintenance_enabled=True,
                next_maintenance_due_date__lt=timezone.localdate(),
            )

        return queryset

    def filter_warranty_expired(self, queryset, name, value):
        if value is True:
            return queryset.filter(
                warranty_end_date__lt=timezone.localdate(),
            )

        if value is False:
            return queryset.exclude(
                warranty_end_date__lt=timezone.localdate(),
            )

        return queryset