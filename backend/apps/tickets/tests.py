from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.employees.models import Employee
from apps.tickets.models import Ticket, TicketComment

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

        self.employee = Employee.objects.create(
            user=self.requester,
            full_name="Requester Personel",
            email="requester@example.com",
            is_active=True,
        )

    def test_requester_can_create_ticket_for_own_employee_profile(self):
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