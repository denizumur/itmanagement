import django_filters

from apps.audit.constants import CRITICAL_AUDIT_ACTIONS
from apps.audit.models import AuditLog


class AuditLogFilterSet(django_filters.FilterSet):
    entity_type = django_filters.CharFilter(method="filter_entity_type")
    entity_id = django_filters.CharFilter(field_name="entity_id", lookup_expr="exact")
    action = django_filters.CharFilter(method="filter_action")
    actor = django_filters.NumberFilter(field_name="actor_id")
    date_from = django_filters.DateFilter(method="filter_date_from")
    date_to = django_filters.DateFilter(method="filter_date_to")
    module = django_filters.CharFilter(method="filter_module")
    metadata_module = django_filters.CharFilter(method="filter_module")
    operation = django_filters.CharFilter(method="filter_operation")
    critical = django_filters.BooleanFilter(method="filter_critical")

    class Meta:
        model = AuditLog
        fields = []

    def get_list_values(self, name, value):
        values = []

        getlist = getattr(self.data, "getlist", None)

        if callable(getlist):
            values.extend(getlist(name))
        elif value:
            values.append(value)

        normalized_values = []

        for item in values:
            for part in str(item).split(","):
                part = part.strip()

                if part:
                    normalized_values.append(part)

        return normalized_values

    def filter_entity_type(self, queryset, name, value):
        values = self.get_list_values(name, value)

        if not values:
            return queryset

        return queryset.filter(entity_type__in=values)

    def filter_action(self, queryset, name, value):
        values = self.get_list_values(name, value)

        if not values:
            return queryset

        return queryset.filter(action__in=values)

    def filter_date_from(self, queryset, name, value):
        if not value:
            return queryset

        return queryset.filter(created_at__date__gte=value)

    def filter_date_to(self, queryset, name, value):
        if not value:
            return queryset

        return queryset.filter(created_at__date__lte=value)

    def filter_module(self, queryset, name, value):
        value = (value or "").strip()

        if not value:
            return queryset

        return queryset.filter(metadata__module=value)

    def filter_operation(self, queryset, name, value):
        value = (value or "").strip()

        if not value:
            return queryset

        return queryset.filter(metadata__operation=value)

    def filter_critical(self, queryset, name, value):
        if value is not True:
            return queryset

        return queryset.filter(action__in=CRITICAL_AUDIT_ACTIONS)