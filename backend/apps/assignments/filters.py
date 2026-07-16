from django.db.models import Q
from django_filters import rest_framework as filters

from apps.assignments.models import Assignment


class AssignmentFilterSet(filters.FilterSet):
    active = filters.BooleanFilter(method="filter_active")

    asset = filters.NumberFilter(field_name="asset_id")
    employee = filters.NumberFilter(field_name="employee_id")

    asset_category = filters.NumberFilter(field_name="asset__category_id")
    employee_department = filters.NumberFilter(field_name="employee__department_id")
    employee_job_title = filters.NumberFilter(field_name="employee__job_title_id")

    assigned_by = filters.NumberFilter(field_name="assigned_by_id")
    returned_by = filters.NumberFilter(field_name="returned_by_id")

    assigned_before = filters.DateFilter(method="filter_assigned_before")
    assigned_after = filters.DateFilter(method="filter_assigned_after")
    returned_before = filters.DateFilter(method="filter_returned_before")
    returned_after = filters.DateFilter(method="filter_returned_after")

    class Meta:
        model = Assignment
        fields = [
            "active",
            "asset",
            "employee",
            "asset_category",
            "employee_department",
            "employee_job_title",
            "assigned_by",
            "returned_by",
            "assigned_before",
            "assigned_after",
            "returned_before",
            "returned_after",
        ]

    def filter_active(self, queryset, name, value):
        if value is True:
            return queryset.filter(returned_at__isnull=True)

        if value is False:
            return queryset.filter(returned_at__isnull=False)

        return queryset

    def filter_assigned_before(self, queryset, name, value):
        return queryset.filter(assigned_at__date__lte=value)

    def filter_assigned_after(self, queryset, name, value):
        return queryset.filter(assigned_at__date__gte=value)

    def filter_returned_before(self, queryset, name, value):
        return queryset.filter(returned_at__date__lte=value)

    def filter_returned_after(self, queryset, name, value):
        return queryset.filter(returned_at__date__gte=value)