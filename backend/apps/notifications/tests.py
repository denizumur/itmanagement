from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.employees.models import Employee
from apps.reminders.models import Reminder
from apps.tickets.models import Ticket
from apps.tickets.models import Ticket, TicketApproval

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
        self.technician_user = self.create_user_with_role(
            "technician-user",
            UserProfile.Role.TECHNICIAN,
        )
        self.approver_user = self.create_user_with_role(
            "approver-user",
            UserProfile.Role.APPROVER,
        )
        self.other_approver_user = self.create_user_with_role(
            "other-approver-user",
            UserProfile.Role.APPROVER,
        )
        self.employee = Employee.objects.create(
            user=self.requester_user,
            full_name="Requester Personel",
            email="requester@example.com",
            is_active=True,
        )
        self.approver_employee = Employee.objects.create(
            user=self.approver_user,
            full_name="Approver Manager",
            email="approver@example.com",
            is_active=True,
        )
        self.other_approver_employee = Employee.objects.create(
            user=self.other_approver_user,
            full_name="Other Approver Manager",
            email="other.approver@example.com",
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

    def test_approver_gets_own_pending_approval_notification(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Finans raporlama erişimi",
            description="Muhasebe raporları için erişim talebi.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.HIGH,
            approval_status=Ticket.ApprovalStatus.PENDING,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )

        approval = TicketApproval.objects.create(
            ticket=ticket,
            approver=self.approver_employee,
            approver_user=self.approver_user,
            requested_by=self.requester_user,
        )

        self.client.force_authenticate(user=self.approver_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        critical_ids = {item["id"] for item in response.data["critical"]}

        self.assertIn(f"ticket_approval:{approval.id}", critical_ids)
        self.assertEqual(response.data["counts"]["critical"], 1)
        self.assertEqual(response.data["counts"]["total"], 1)
        self.assertEqual(
            response.data["overview"]["pending_approvals"][0]["metadata"]["ticket_id"],
            ticket.id,
        )

    def test_unrelated_approver_does_not_get_someone_elses_pending_approval_notification(self):
        self.employee.manager = self.approver_employee
        self.employee.save(update_fields=["manager"])

        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Satın alma erişim talebi",
            description="Satın alma ekranına erişim talebi.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.PENDING,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )

        TicketApproval.objects.create(
            ticket=ticket,
            approver=self.approver_employee,
            approver_user=self.approver_user,
            requested_by=self.requester_user,
        )

        self.client.force_authenticate(user=self.other_approver_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["counts"]["total"], 0)
        self.assertEqual(response.data["normal"], [])
        self.assertEqual(response.data["critical"], [])

    def test_operational_user_does_not_get_pending_approval_ticket_until_approved(self):
        pending_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Onay bekleyen donanım talebi",
            description="Bu ticket onaylanmadan IT notification tarafında görünmemeli.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.URGENT,
            approval_status=Ticket.ApprovalStatus.PENDING,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )
        TicketApproval.objects.create(
            ticket=pending_ticket,
            approver=self.approver_employee,
            approver_user=self.approver_user,
            requested_by=self.requester_user,
        )

        approved_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Onaylanmış IT talebi",
            description="Bu ticket IT notification tarafında görünmeli.",
            category=Ticket.Category.HARDWARE,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.APPROVED,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )

        self.client.force_authenticate(user=self.technician_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = {
            item["id"]
            for item in response.data["normal"] + response.data["critical"]
        }

        self.assertNotIn(f"ticket:{pending_ticket.id}", ids)
        self.assertIn(f"ticket:{approved_ticket.id}", ids)

    def test_notification_response_contains_unified_items_sorted_by_urgency_score(self):
        today = timezone.localdate()

        overdue = self.create_reminder(
            title="Gecikmiş lisans",
            due_date=today - timezone.timedelta(days=1),
            threshold_days=1,
        )

        urgent_ticket = Ticket.objects.create(
            employee=self.employee,
            title="Acil network kesintisi",
            description="Tüm ofiste internet yok.",
            category=Ticket.Category.NETWORK,
            priority=Ticket.Priority.URGENT,
            status=Ticket.Status.OPEN,
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

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("items", response.data)

        items = response.data["items"]
        scores = [item["urgency_score"] for item in items]

        self.assertEqual(scores, sorted(scores, reverse=True))

        score_by_id = {item["id"]: item["urgency_score"] for item in items}

        self.assertEqual(score_by_id[f"reminder:{overdue.id}"], 100)
        self.assertEqual(score_by_id[f"ticket:{urgent_ticket.id}"], 95)
        self.assertEqual(score_by_id[f"reminder:{due_today.id}"], 90)
        self.assertEqual(score_by_id[f"reminder:{seven_days.id}"], 60)
        self.assertEqual(score_by_id[f"reminder:{thirty_days.id}"], 20)

    def test_pending_approval_has_urgency_score_85(self):
        ticket = Ticket.objects.create(
            employee=self.employee,
            title="Onay bekleyen erişim talebi",
            description="Finans raporlarına erişim talebi.",
            category=Ticket.Category.ACCESS,
            priority=Ticket.Priority.NORMAL,
            approval_status=Ticket.ApprovalStatus.PENDING,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )

        approval = TicketApproval.objects.create(
            ticket=ticket,
            approver=self.approver_employee,
            approver_user=self.approver_user,
            requested_by=self.requester_user,
        )

        self.client.force_authenticate(user=self.approver_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        items = response.data["items"]
        score_by_id = {item["id"]: item["urgency_score"] for item in items}

        self.assertEqual(score_by_id[f"ticket_approval:{approval.id}"], 85)
        self.assertEqual(response.data["counts"]["critical"], 1)

    def test_notification_response_keeps_backward_compatible_sections(self):
        Ticket.objects.create(
            employee=self.employee,
            title="Normal ticket",
            description="Normal ticket bildirimi.",
            category=Ticket.Category.OTHER,
            priority=Ticket.Priority.NORMAL,
            status=Ticket.Status.OPEN,
            created_by=self.requester_user,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn("items", response.data)
        self.assertIn("normal", response.data)
        self.assertIn("critical", response.data)
        self.assertIn("overview", response.data)
        self.assertIn("polling", response.data)
        self.assertIn("interval_seconds", response.data["polling"])