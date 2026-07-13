from apps.assignments.models import Assignment
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, serialize_instance
from apps.inventory.models import Asset


ASSIGNMENT_AUDIT_EXCLUDE_FIELDS = (
    "created_at",
    "updated_at",
)


def create_assignment_for_asset(
    *,
    asset,
    employee,
    assigned_by,
    request=None,
    assigned_at=None,
    notes="",
):
    assignment = Assignment(
        asset=asset,
        employee=employee,
        assigned_by=assigned_by,
        notes=notes or "",
    )

    if assigned_at:
        assignment.assigned_at = assigned_at

    assignment.save()

    asset_status_before = asset.status

    asset.status = Asset.Status.ASSIGNED
    asset.updated_by = assigned_by
    asset.save(update_fields=["status", "updated_by", "updated_at"])

    create_audit_log(
        request=request,
        action=AuditLog.Action.ASSIGN,
        instance=assignment,
        before={},
        after=serialize_instance(
            assignment,
            exclude=ASSIGNMENT_AUDIT_EXCLUDE_FIELDS,
        ),
        metadata={
            "module": "assignments",
            "operation": "assignment_create",
            "asset_id": assignment.asset_id,
            "employee_id": assignment.employee_id,
            "asset_status_before": asset_status_before,
            "asset_status_after": asset.status,
        },
    )

    return assignment