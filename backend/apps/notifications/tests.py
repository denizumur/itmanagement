from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.employees.models import Employee
from apps.reminders.models import Reminder
from apps.tickets.models import Ticket

User = get_user_model()


class NotificationCenterApiTests(APITestCase):
    def create_user_with_role(self, username, role):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="StrongPass123!",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save(update_fields=["role"])

        return User.objects.get(pk=user.pk)

    def setUp(self):
        self.admin_user = self.create_user_with_role(
            "admin-user",
            UserProfile.Role.ADMIN,
        )
        self.requester_user = self.create_user_with_role(
            "requester-user",
            UserProfile.Role.REQUESTER,
        )
        self.employee = Employee.objects.create(
            user=self.requester_user,
            full_name="Requester Personel",
            email="requester@example.com",
            is_active=True,
        )

    def create_reminder(self, *, title, due_date, threshold_days, status_value=None):
        return Reminder.objects.create(
            source_type=Reminder.SourceType.LICENSE,
            source_id=1000 + Reminder.objects.count(),
            title=title,
            message=f"{title} mesajı",
            due_date=due_date,
            threshold_days=threshold_days,
            channel=Reminder.Channel.IN_APP,
            status=status_value or Reminder.Status.PENDING,
        )

    def test_operational_user_gets_ticket_and_reminder_notifications(self):
        today = timezone.localdate()

        urgent_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Acil VPN erişim problemi",
            description="VPN erişimi tamamen kesildi.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.URGENT,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )
        normal_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Mouse arızası",
            description="Mouse tıklamaları ara sıra çalışmıyor.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )
        Ticket.objects.create(
            employee=self.employee,
            title="Kapanmış ticket",
            description="Bu ticket bildirimde görünmemeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.URGENT,
            status=Ticket.Status.CLOSED,
            created_by=self.requester_user,
        )

        due_today = self.create_reminder(
            title="Bugün biten lisans",
            due_date=today,
            threshold_days=1,
        )
        seven_days = self.create_reminder(
            title="7 gün kalan lisans",
            due_date=today + timezone.timedelta(days=7),
            threshold_days=7,
        )
        thirty_days = self.create_reminder(
            title="30 gün kalan lisans",
            due_date=today + timezone.timedelta(days=30),
            threshold_days=30,
        )
        self.create_reminder(
            title="Gizlenmiş reminder",
            due_date=today,
            threshold_days=1,
            status_value=Reminder.Status.DISMISSED,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        critical_ids = {item["id"] for item in response.data["critical"]}
        normal_ids = {item["id"] for item in response.data["normal"]}

        self.assertIn(f"ticket:{urgent_ticket.id}", critical_ids)
        self.assertIn(f"reminder:{due_today.id}", critical_ids)

        self.assertIn(f"ticket:{normal_ticket.id}", normal_ids)
        self.assertIn(f"reminder:{seven_days.id}", normal_ids)
        self.assertIn(f"reminder:{thirty_days.id}", normal_ids)

        self.assertEqual(len(response.data["overview"]["urgent_tickets"]), 1)
        self.assertEqual(len(response.data["overview"]["reminders_due_today"]), 1)
        self.assertEqual(len(response.data["overview"]["reminders_7_days"]), 1)
        self.assertEqual(len(response.data["overview"]["reminders_30_days"]), 1)

        self.assertEqual(response.data["counts"]["critical"], 2)
        self.assertEqual(response.data["counts"]["normal"], 3)
        self.assertEqual(response.data["counts"]["total"], 5)

    def test_requester_gets_only_own_ticket_notifications(self):
        other_requester = self.create_user_with_role(
            "other-requester",
            UserProfile.Role.REQUESTER,
        )
        other_employee = Employee.objects.create(
            user=other_requester,
            full_name="Other Requester",
            email="other@example.com",
            is_active=True,
        )

        own_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Benim ticketım",
            description="Requester sadece bunu görmeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )
        Ticket.objects.create(
            employee=other_employee,
            title="Başkasının ticketı",
            description="Requester bunu görmemeli.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.URGENT,
            status=Ticket.Status.OPEN,
            created_by=other_requester,
        )

        self.client.force_authenticate(user=self.requester_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = {
            item["id"]
            for item in response.data["normal"] + response.data["critical"]
        }

        self.assertEqual(ids, {f"ticket:{own_ticket.id}"})


    def test_reminder_notifications_are_deduplicated_by_source_and_due_date(self):
        today = timezone.localdate()
        due_date = today + timezone.timedelta(days=3)

        for threshold_days in [30, 15, 7]:
            Reminder.objects.create(
                source_type=Reminder.SourceType.LICENSE,
                source_id=4242,
                title="Tekrarlı lisans hatırlatıcısı",
                message="Aynı kaynak için birden fazla threshold var.",
                due_date=due_date,
                threshold_days=threshold_days,
                channel=Reminder.Channel.IN_APP,
                status=Reminder.Status.PENDING,
            )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        matching_items = [
            item
            for item in response.data["normal"]
            if item["metadata"].get("source_type") == Reminder.SourceType.LICENSE
            and item["metadata"].get("source_type_label") == "Lisans / Abonelik"
            and str(item["metadata"].get("due_date")) == str(due_date)
        ]

        self.assertEqual(len(matching_items), 1)
        self.assertEqual(matching_items[0]["metadata"]["threshold_days"], 7)