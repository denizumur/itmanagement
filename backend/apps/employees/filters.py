from django_filters import rest_framework as filters

from apps.accounts.models import UserProfile
from apps.employees.models import Employee


class EmployeeFilterSet(filters.FilterSet):
    department = filters.NumberFilter(field_name="department_id")
    job_title = filters.NumberFilter(field_name="job_title_id")
    manager = filters.NumberFilter(field_name="manager_id")
    is_active = filters.BooleanFilter(field_name="is_active")
    sync_source = filters.ChoiceFilter(choices=Employee.SyncSource.choices)
    user_role = filters.ChoiceFilter(
        field_name="user__profile__role",
        choices=UserProfile.Role.choices,
    )
    has_user = filters.BooleanFilter(method="filter_has_user")

    class Meta:
        model = Employee
        fields = [
            "department",
            "job_title",
            "manager",
            "is_active",
            "sync_source",
            "user_role",
            "has_user",
        ]

    def filter_has_user(self, queryset, name, value):
        if value is True:
            return queryset.filter(user__isnull=False)

        if value is False:
            return queryset.filter(user__isnull=True)

        return queryset