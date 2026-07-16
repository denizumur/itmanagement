from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters

from apps.licensing.models import LicenseSubscription


class LicenseSubscriptionFilterSet(filters.FilterSet):
    type = filters.ChoiceFilter(choices=LicenseSubscription.Type.choices)
    billing_cycle = filters.ChoiceFilter(
        choices=LicenseSubscription.BillingCycle.choices
    )
    vendor = filters.CharFilter(field_name="vendor", lookup_expr="icontains")
    assigned_asset = filters.NumberFilter(field_name="assigned_asset_id")
    is_active = filters.BooleanFilter(field_name="is_active")
    auto_renew = filters.BooleanFilter(field_name="auto_renew")
    deleted = filters.BooleanFilter(method="filter_deleted")
    expired = filters.BooleanFilter(method="filter_expired")
    upcoming = filters.BooleanFilter(method="filter_upcoming")

    end_before = filters.DateFilter(field_name="end_date", lookup_expr="lte")
    end_after = filters.DateFilter(field_name="end_date", lookup_expr="gte")
    start_before = filters.DateFilter(field_name="start_date", lookup_expr="lte")
    start_after = filters.DateFilter(field_name="start_date", lookup_expr="gte")

    class Meta:
        model = LicenseSubscription
        fields = [
            "type",
            "billing_cycle",
            "vendor",
            "assigned_asset",
            "is_active",
            "auto_renew",
            "deleted",
            "expired",
            "upcoming",
            "end_before",
            "end_after",
            "start_before",
            "start_after",
        ]

    def filter_deleted(self, queryset, name, value):
        if value is True:
            return queryset.filter(is_deleted=True)

        if value is False:
            return queryset.filter(is_deleted=False)

        return queryset

    def filter_expired(self, queryset, name, value):
        today = timezone.localdate()

        if value is True:
            return queryset.filter(end_date__lt=today)

        if value is False:
            return queryset.filter(Q(end_date__isnull=True) | Q(end_date__gte=today))

        return queryset

    def filter_upcoming(self, queryset, name, value):
        today = timezone.localdate()

        if value is True:
            return queryset.filter(
                end_date__gte=today,
                end_date__lte=today + timezone.timedelta(days=30),
            )

        if value is False:
            return queryset.exclude(
                end_date__gte=today,
                end_date__lte=today + timezone.timedelta(days=30),
            )

        return queryset