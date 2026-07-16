from django_filters import rest_framework as filters

from apps.tickets.models import Ticket


class TicketFilterSet(filters.FilterSet):
    status = filters.ChoiceFilter(
        field_name="status",
        choices=Ticket.Status.choices,
    )
    priority = filters.ChoiceFilter(
        field_name="priority",
        choices=Ticket.Priority.choices,
    )
    category = filters.ChoiceFilter(
        field_name="category",
        choices=Ticket.Category.choices,
    )
    approval_status = filters.ChoiceFilter(
        field_name="approval_status",
        choices=Ticket.ApprovalStatus.choices,
    )

    employee = filters.NumberFilter(field_name="employee_id")
    asset = filters.NumberFilter(field_name="asset_id")
    assigned_to = filters.NumberFilter(field_name="assigned_to_id")
    created_by = filters.NumberFilter(field_name="created_by_id")

    created_after = filters.DateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_before = filters.DateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )
    updated_after = filters.DateTimeFilter(
        field_name="updated_at",
        lookup_expr="gte",
    )
    updated_before = filters.DateTimeFilter(
        field_name="updated_at",
        lookup_expr="lte",
    )
    resolved_after = filters.DateTimeFilter(
        field_name="resolved_at",
        lookup_expr="gte",
    )
    resolved_before = filters.DateTimeFilter(
        field_name="resolved_at",
        lookup_expr="lte",
    )
    closed_after = filters.DateTimeFilter(
        field_name="closed_at",
        lookup_expr="gte",
    )
    closed_before = filters.DateTimeFilter(
        field_name="closed_at",
        lookup_expr="lte",
    )

    class Meta:
        model = Ticket
        fields = [
            "status",
            "priority",
            "category",
            "approval_status",
            "employee",
            "asset",
            "assigned_to",
            "created_by",
            "created_after",
            "created_before",
            "updated_after",
            "updated_before",
            "resolved_after",
            "resolved_before",
            "closed_after",
            "closed_before",
        ]