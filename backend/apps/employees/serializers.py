from rest_framework import serializers

from apps.assignments.models import Assignment
from apps.employees.models import Employee
from apps.tickets.models import Ticket


def get_user_profile(user):
    if not user:
        return None

    return getattr(user, "profile", None)


class EmployeeListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)

    username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_role = serializers.SerializerMethodField()
    user_role_label = serializers.SerializerMethodField()
    user_is_active = serializers.BooleanField(source="user.is_active", read_only=True)

    department_name = serializers.CharField(source="department.name", read_only=True)
    job_title_name = serializers.CharField(source="job_title.name", read_only=True)

    manager_name = serializers.CharField(source="manager.full_name", read_only=True)
    manager_email = serializers.EmailField(source="manager.email", read_only=True)

    sync_source_label = serializers.CharField(
        source="get_sync_source_display",
        read_only=True,
    )

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "username",
            "user_email",
            "user_role",
            "user_role_label",
            "user_is_active",
            "full_name",
            "name",
            "employee_code",
            "email",
            "phone",
            "department",
            "department_name",
            "job_title",
            "job_title_name",
            "manager",
            "manager_name",
            "manager_email",
            "external_hr_id",
            "sync_source",
            "sync_source_label",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_user_role(self, employee):
        profile = get_user_profile(employee.user)

        if not profile:
            return None

        return profile.role

    def get_user_role_label(self, employee):
        profile = get_user_profile(employee.user)

        if not profile:
            return None

        return profile.get_role_display()


class EmployeeDetailSerializer(serializers.Serializer):
    employee = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    active_assignments = serializers.SerializerMethodField()
    recent_tickets = serializers.SerializerMethodField()

    def get_employee(self, employee):
        return {
            "id": employee.id,
            "full_name": employee.full_name,
            "name": employee.full_name,
            "employee_code": employee.employee_code,
            "email": employee.email,
            "phone": employee.phone,
            "is_active": employee.is_active,
            "department": (
                {
                    "id": employee.department_id,
                    "name": employee.department.name,
                }
                if employee.department
                else None
            ),
            "job_title": (
                {
                    "id": employee.job_title_id,
                    "name": employee.job_title.name,
                }
                if employee.job_title
                else None
            ),
            "manager": (
                {
                    "id": employee.manager_id,
                    "full_name": employee.manager.full_name,
                    "email": employee.manager.email,
                }
                if employee.manager
                else None
            ),
            "sync_source": employee.sync_source,
            "sync_source_label": employee.get_sync_source_display(),
            "external_hr_id": employee.external_hr_id,
            "notes": employee.notes,
            "created_at": employee.created_at,
            "updated_at": employee.updated_at,
        }

    def get_user(self, employee):
        user = employee.user

        if not user:
            return None

        profile = get_user_profile(user)

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": profile.role if profile else None,
            "role_label": profile.get_role_display() if profile else None,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "last_login": user.last_login,
            "date_joined": user.date_joined,
        }

    def get_summary(self, employee):
        assignments = Assignment.objects.filter(employee=employee)
        tickets = Ticket.objects.filter(employee=employee)

        return {
            "active_assignment_count": assignments.filter(
                returned_at__isnull=True,
            ).count(),
            "total_assignment_count": assignments.count(),
            "open_ticket_count": tickets.filter(status=Ticket.Status.OPEN).count(),
            "in_progress_ticket_count": tickets.filter(
                status=Ticket.Status.IN_PROGRESS,
            ).count(),
            "resolved_ticket_count": tickets.filter(
                status=Ticket.Status.RESOLVED,
            ).count(),
            "closed_ticket_count": tickets.filter(status=Ticket.Status.CLOSED).count(),
            "pending_approval_ticket_count": tickets.filter(
                approval_status=Ticket.ApprovalStatus.PENDING,
            ).count(),
            "total_ticket_count": tickets.count(),
        }

    def get_active_assignments(self, employee):
        assignments = (
            Assignment.objects.select_related(
                "asset",
                "asset__category",
                "assigned_by",
            )
            .filter(
                employee=employee,
                returned_at__isnull=True,
            )
            .order_by("-assigned_at")[:20]
        )

        return [
            {
                "id": assignment.id,
                "asset_id": assignment.asset_id,
                "asset_name": assignment.asset.name,
                "asset_inventory_code": assignment.asset.inventory_code,
                "asset_serial_number": assignment.asset.serial_number,
                "asset_category": (
                    assignment.asset.category.name
                    if assignment.asset.category_id
                    else None
                ),
                "asset_status": assignment.asset.status,
                "asset_status_label": assignment.asset.get_status_display(),
                "asset_display_identifier": assignment.asset.display_identifier,
                "assigned_at": assignment.assigned_at,
                "assigned_by_username": (
                    assignment.assigned_by.username if assignment.assigned_by else None
                ),
                "notes": assignment.notes,
            }
            for assignment in assignments
        ]

    def get_recent_tickets(self, employee):
        tickets = (
            Ticket.objects.select_related(
                "asset",
                "assigned_to",
                "created_by",
            )
            .filter(employee=employee)
            .order_by("-created_at")[:10]
        )

        return [
            {
                "id": ticket.id,
                "title": ticket.title,
                "category": ticket.category,
                "category_label": ticket.get_category_display(),
                "priority": ticket.priority,
                "priority_label": ticket.get_priority_display(),
                "status": ticket.status,
                "status_label": ticket.get_status_display(),
                "approval_status": ticket.approval_status,
                "approval_status_label": ticket.get_approval_status_display(),
                "asset_id": ticket.asset_id,
                "asset_name": ticket.asset.name if ticket.asset else None,
                "assigned_to_username": (
                    ticket.assigned_to.username if ticket.assigned_to else None
                ),
                "created_by_username": (
                    ticket.created_by.username if ticket.created_by else None
                ),
                "created_at": ticket.created_at,
                "updated_at": ticket.updated_at,
            }
            for ticket in tickets
        ]