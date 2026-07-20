from django.utils import timezone

from apps.accounts.models import UserProfile
from apps.employees.models import Employee
from apps.tickets.models import Ticket, TicketApproval


def get_user_role(user):
    return getattr(getattr(user, "profile", None), "role", None)


def user_can_approve(user):
    return get_user_role(user) in {
        UserProfile.Role.APPROVER,
        UserProfile.Role.ADMIN,
    }


def get_approval_manager_for_employee(employee: Employee):
    manager = employee.manager

    if not manager or not manager.is_active or not manager.user:
        return None

    if not user_can_approve(manager.user):
        return None

    return manager


def employee_requires_ticket_approval(employee: Employee):
    return get_approval_manager_for_employee(employee) is not None


def initialize_ticket_approval(ticket: Ticket, *, requested_by):
    approver = get_approval_manager_for_employee(ticket.employee)

    if not approver:
        if ticket.approval_status != Ticket.ApprovalStatus.NOT_REQUIRED:
            ticket.approval_status = Ticket.ApprovalStatus.NOT_REQUIRED
            ticket.save(update_fields=["approval_status", "updated_at"])

        return None

    if ticket.approval_status != Ticket.ApprovalStatus.PENDING:
        ticket.approval_status = Ticket.ApprovalStatus.PENDING
        ticket.save(update_fields=["approval_status", "updated_at"])

    approval, _ = TicketApproval.objects.get_or_create(
        ticket=ticket,
        approver_user=approver.user,
        status=TicketApproval.Status.PENDING,
        defaults={
            "approver": approver,
            "requested_by": requested_by,
        },
    )

    return approval


def approve_ticket(ticket: Ticket, *, approver_user, decision_note):
    approval = get_pending_approval_for_user(ticket, approver_user)

    approval.status = TicketApproval.Status.APPROVED
    approval.decision_note = decision_note
    approval.decided_at = timezone.now()
    approval.save(update_fields=["status", "decision_note", "decided_at", "updated_at"])

    ticket.approval_status = Ticket.ApprovalStatus.APPROVED
    ticket.save(update_fields=["approval_status", "updated_at"])

    return approval


def reject_ticket(ticket: Ticket, *, approver_user, decision_note):
    approval = get_pending_approval_for_user(ticket, approver_user)

    now = timezone.now()

    approval.status = TicketApproval.Status.REJECTED
    approval.decision_note = decision_note
    approval.decided_at = now
    approval.save(update_fields=["status", "decision_note", "decided_at", "updated_at"])

    ticket.approval_status = Ticket.ApprovalStatus.REJECTED
    ticket.status = Ticket.Status.CLOSED
    ticket.closed_at = now
    ticket.save(update_fields=["approval_status", "status", "closed_at", "updated_at"])

    return approval


def get_pending_approval_for_user(ticket: Ticket, user):
    queryset = TicketApproval.objects.filter(
        ticket=ticket,
        status=TicketApproval.Status.PENDING,
    )

    if get_user_role(user) != UserProfile.Role.ADMIN:
        queryset = queryset.filter(approver_user=user)

    approval = queryset.select_related("ticket", "approver", "approver_user").first()

    if not approval:
        return None

    return approval