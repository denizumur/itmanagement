from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.employees.models import Employee
from apps.tickets.models import Ticket, TicketApproval, TicketComment

User = get_user_model()


class TicketApiTests(APITestCase):
    def create_user_with_role(self, username, role):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="StrongPass123!",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save(update_fields=["role"])

        # Reverse OneToOne cache yüzünden testlerde eski default role okunmasın.
        return User.objects.get(pk=user.pk)

    def setUp(self):
        self.requester = self.create_user_with_role(
            "requester-user",
            UserProfile.Role.REQUESTER,
        )
        self.technician = self.create_user_with_role(
            "technician-user",
            UserProfile.Role.TECHNICIAN,
        )
        self.viewer = self.create_user_with_role(
            "viewer-user",
            UserProfile.Role.VIEWER,
        )
        self.approver = self.create_user_with_role(
            "approver-user",
            UserProfile.Role.APPROVER,
        )
        self.admin = self.create_user_with_role(
            "admin-user",
            UserProfile.Role.ADMIN,
        )

        self.approver_employee = Employee.objects.create(
            user=self.approver,
            full_name="Approver Manager",
            email="approver@example.com",
            is_active=True,
        )

        self.employee = Employee.objects.create(
            user=self.requester,
            full_name="Requester Personel",
            email="requester@example.com",
            is_active=True,
        )

    def test_requester_can_create_ticket_for_own_employee_profile_without_manager(self):
        self.client.force_authenticate(user=self.requester)

        response = self.client.post(
            "/api/tickets/",
            {
                "title": "Laptop açılmıyor",
                "description": "Laptop sabah açılmadı, güç ışığı yanmıyor.",
                "category": Ticket.Category.HARDWARE,
                "priority": Ticket.Priority.NORMAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Ticket.objects.count(), 1)

        ticket = Ticket.objects.get()

        self.assertEqual(ticket.employee, self.employee)
        self.assertEqual(ticket.created_by, self.requester)
        self.assertEqual(ticket.status, Ticket.Status.OPEN)
        self.assertEqual(
            ticket.approval_status,
            Ticket.ApprovalStatus.NOT_REQUIRED,
        )
        self.assertIsNone(ticket.assigned_to)
        self.assertEqual(TicketApproval.objects.count(), 0)

    def test_requester_without_employee_mapping_gets_400_when_creating_ticket(self):
        requester_without_employee = self.create_user_with_role(
            "requester-without-employee",
            UserProfile.Role.REQUESTER,
        )

        self.client.force_authenticate(user=requester_without_employee)

        response = self.client.post(
            "/api/tickets/",
            {
                "title": "VPN sorunu",
                "description": "VPN bağlantısı kurulamıyor, hata alıyorum.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Ticket.objects.count(), 0)
        self.assertIn("employee", response.data)

    def test_requester_cannot_view_it_ticket_queue(self):
        Ticket.objects.create(
            employee=self.employee,
            title="Mouse çalışmıyor",
            description="Mouse tıklamaları bazen algılanmıyor.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.get("/api/tickets/queue/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_technician_can_view_queue_and_update_ticket_status(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Yazıcı problemi",
            description="Departman yazıcısından çıktı alınamıyor.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.HIGH,
            created_by=self.requester,
        )

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 1)
        self.assertEqual(queue_response.data[0]["id"], ticket.id)

        status_response = self.client.post(
            f"/api/tickets/{ticket.id}/status/",
            {
                "status": Ticket.Status.IN_PROGRESS,
            },
            format="json",
        )

        self.assertEqual(status_response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()

        self.assertEqual(ticket.status, Ticket.Status.IN_PROGRESS)

    def test_requester_cannot_see_internal_comments(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="E-posta erişimi",
            description="Kurumsal e-posta hesabıma erişemiyorum.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.NORMAL,
            created_by=self.requester,
        )

        public_comment = TicketComment.objects.create(
            ticket=ticket,
            author=self.technician,
            body="Talebin alındı, kontrol ediyoruz.",
            is_internal=False,
        )
        TicketComment.objects.create(
            ticket=ticket,
            author=self.technician,
            body="IT iç notu: önce hesap kilidini kontrol et.",
            is_internal=True,
        )

        self.client.force_authenticate(user=self.requester)

        response = self.client.get(f"/api/tickets/{ticket.id}/comments/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], public_comment.id)
        self.assertFalse(response.data[0]["is_internal"])

    def test_ticket_with_approver_manager_requires_approval_and_stays_out_of_it_queue(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Yeni muhasebe yazılımı erişimi",
                "description": "Muhasebe raporları için yeni yazılım erişimine ihtiyacım var.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.PENDING)
        self.assertEqual(ticket.status, Ticket.Status.OPEN)

        approval = TicketApproval.objects.get(ticket=ticket)

        self.assertEqual(approval.status, TicketApproval.Status.PENDING)
        self.assertEqual(approval.approver, self.approver_employee)
        self.assertEqual(approval.approver_user, self.approver)

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 0)

        self.client.force_authenticate(user=self.approver)

        approvals_response = self.client.get("/api/tickets/approvals/")

        self.assertEqual(approvals_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(approvals_response.data), 1)
        self.assertEqual(approvals_response.data[0]["ticket"]["id"], ticket.id)

    def test_approver_can_approve_ticket_and_then_it_queue_can_see_it(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "ERP erişim talebi",
                "description": "ERP muhasebe modülüne erişim talep ediyorum.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.NORMAL,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.client.force_authenticate(user=self.approver)

        approve_response = self.client.post(
            f"/api/tickets/{ticket.id}/approve/",
            {
                "decision_note": "Departman ihtiyacı uygun görüldü.",
            },
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()
        approval = TicketApproval.objects.get(ticket=ticket)

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.APPROVED)
        self.assertEqual(ticket.status, Ticket.Status.OPEN)
        self.assertEqual(approval.status, TicketApproval.Status.APPROVED)
        self.assertEqual(
            approval.decision_note,
            "Departman ihtiyacı uygun görüldü.",
        )
        self.assertIsNotNone(approval.decided_at)

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 1)
        self.assertEqual(queue_response.data[0]["id"], ticket.id)

    def test_approver_can_reject_ticket_and_it_queue_cannot_see_it(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Yeni monitör talebi",
                "description": "Çift ekran kullanmak için yeni monitör talep ediyorum.",
                "category": Ticket.Category.HARDWARE,
                "priority": Ticket.Priority.NORMAL,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.client.force_authenticate(user=self.approver)

        reject_response = self.client.post(
            f"/api/tickets/{ticket.id}/reject/",
            {
                "decision_note": "Bu ay bütçe uygun değil.",
            },
            format="json",
        )

        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)

        ticket.refresh_from_db()
        approval = TicketApproval.objects.get(ticket=ticket)

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.REJECTED)
        self.assertEqual(ticket.status, Ticket.Status.CLOSED)
        self.assertIsNotNone(ticket.closed_at)
        self.assertEqual(approval.status, TicketApproval.Status.REJECTED)
        self.assertEqual(approval.decision_note, "Bu ay bütçe uygun değil.")
        self.assertIsNotNone(approval.decided_at)

        self.client.force_authenticate(user=self.technician)

        queue_response = self.client.get("/api/tickets/queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 0)

    def test_non_assigned_approver_cannot_access_someone_elses_pending_ticket(self):
        other_approver = self.create_user_with_role(
            "other-approver",
            UserProfile.Role.APPROVER,
        )
        Employee.objects.create(
            user=other_approver,
            full_name="Other Approver",
            email="other.approver@example.com",
            is_active=True,
        )

        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        self.client.force_authenticate(user=self.requester)

        create_response = self.client.post(
            "/api/tickets/",
            {
                "title": "Yetki talebi",
                "description": "Finans raporlarına erişim yetkisi istiyorum.",
                "category": Ticket.Category.ACCESS,
                "priority": Ticket.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get()

        self.client.force_authenticate(user=other_approver)

        approve_response = self.client.post(
            f"/api/tickets/{ticket.id}/approve/",
            {
                "decision_note": "Ben bu talebin yöneticisi değilim.",
            },
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_404_NOT_FOUND)

        ticket.refresh_from_db()

        self.assertEqual(ticket.approval_status, Ticket.ApprovalStatus.PENDING)