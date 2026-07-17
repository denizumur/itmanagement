from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.reminders.models import Reminder
from apps.reminders.services import DEFAULT_THRESHOLDS, ReminderGenerationService

User = get_user_model()


class ReminderApiTests(APITestCase):
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
        self.viewer_user = self.create_user_with_role(
            "viewer-user",
            UserProfile.Role.VIEWER,
        )

    def create_reminder(
        self,
        *,
        title,
        due_date,
        threshold_days=1,
        status_value=None,
        snoozed_until=None,
        source_type=Reminder.SourceType.LICENSE,
        channel=Reminder.Channel.IN_APP,
    ):
        return Reminder.objects.create(
            source_type=source_type,
            source_id=1000 + Reminder.objects.count(),
            title=title,
            message=f"{title} mesajı",
            due_date=due_date,
            threshold_days=threshold_days,
            channel=channel,
            status=status_value or Reminder.Status.PENDING,
            snoozed_until=snoozed_until,
        )

    def test_default_generation_thresholds_are_30_7_1(self):
        service = ReminderGenerationService()

        self.assertEqual(DEFAULT_THRESHOLDS, [30, 7, 1])
        self.assertEqual(service.thresholds, [30, 7, 1])

    def test_visible_reminders_exclude_snoozed_until_today_and_include_expired_snooze(
        self,
    ):
        today = timezone.localdate()

        visible_reminder = self.create_reminder(
            title="Görünür reminder",
            due_date=today,
            threshold_days=1,
        )
        snoozed_today = self.create_reminder(
            title="Bugün gizlenen reminder",
            due_date=today,
            threshold_days=1,
            snoozed_until=today,
        )
        snoozed_yesterday = self.create_reminder(
            title="Dün gizlenmiş reminder",
            due_date=today,
            threshold_days=1,
            snoozed_until=today - timezone.timedelta(days=1),
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/reminders/", {"visible": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = {item["id"] for item in response.data}

        self.assertIn(visible_reminder.id, ids)
        self.assertIn(snoozed_yesterday.id, ids)
        self.assertNotIn(snoozed_today.id, ids)

    def test_snooze_today_keeps_reminder_pending_and_hides_it_from_visible_list(self):
        today = timezone.localdate()

        reminder = self.create_reminder(
            title="Bugün gizlenecek reminder",
            due_date=today,
            threshold_days=1,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(f"/api/reminders/{reminder.id}/snooze_today/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        reminder.refresh_from_db()

        self.assertEqual(reminder.status, Reminder.Status.PENDING)
        self.assertEqual(reminder.snoozed_until, today)
        self.assertIsNotNone(reminder.snoozed_at)

        visible_response = self.client.get("/api/reminders/", {"visible": "true"})

        self.assertEqual(visible_response.status_code, status.HTTP_200_OK)

        ids = {item["id"] for item in visible_response.data}

        self.assertNotIn(reminder.id, ids)

    def test_summary_buckets_are_exclusive_and_ignore_snoozed_today(self):
        today = timezone.localdate()

        self.create_reminder(
            title="Geciken reminder",
            due_date=today - timezone.timedelta(days=1),
            threshold_days=1,
        )
        self.create_reminder(
            title="Bugün reminder",
            due_date=today,
            threshold_days=1,
        )
        self.create_reminder(
            title="7 gün içi reminder",
            due_date=today + timezone.timedelta(days=7),
            threshold_days=30,
        )
        self.create_reminder(
            title="30 gün içi reminder",
            due_date=today + timezone.timedelta(days=20),
            threshold_days=30,
        )
        self.create_reminder(
            title="Gelecek reminder",
            due_date=today + timezone.timedelta(days=45),
            threshold_days=30,
        )
        self.create_reminder(
            title="Bugün gizlenmiş reminder",
            due_date=today,
            threshold_days=1,
            snoozed_until=today,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/reminders/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data["pending"], 6)
        self.assertEqual(response.data["visible_pending"], 4)
        self.assertEqual(response.data["snoozed_today"], 1)
        self.assertEqual(response.data["overdue_due_date"], 1)
        self.assertEqual(response.data["due_today"], 1)
        self.assertEqual(response.data["upcoming_7_days"], 1)
        self.assertEqual(response.data["upcoming_30_days"], 1)

    def test_viewer_cannot_snooze_reminder(self):
        today = timezone.localdate()

        reminder = self.create_reminder(
            title="Viewer gizleyemez",
            due_date=today,
            threshold_days=1,
        )

        self.client.force_authenticate(user=self.viewer_user)

        response = self.client.post(f"/api/reminders/{reminder.id}/snooze_today/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reminder_table_endpoint_returns_paginated_response(self):
        today = timezone.localdate()

        reminder = self.create_reminder(
            title="Table endpoint reminder",
            due_date=today,
            threshold_days=1,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/reminders/table/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

        ids = {item["id"] for item in response.data["results"]}

        self.assertIn(reminder.id, ids)

    def test_legacy_reminder_endpoint_still_returns_array(self):
        today = timezone.localdate()

        self.create_reminder(
            title="Legacy endpoint reminder",
            due_date=today,
            threshold_days=1,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/reminders/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_reminder_table_supports_search(self):
        today = timezone.localdate()

        expected = self.create_reminder(
            title="Özel lisans yenileme reminder",
            due_date=today,
            threshold_days=1,
        )
        self.create_reminder(
            title="Bakım hatırlatma",
            due_date=today,
            threshold_days=1,
            source_type=Reminder.SourceType.MAINTENANCE,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/reminders/table/",
            {"search": "lisans yenileme"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], expected.id)

    def test_reminder_table_supports_source_status_and_channel_filters(self):
        today = timezone.localdate()

        expected = self.create_reminder(
            title="Garanti pending email",
            due_date=today,
            threshold_days=1,
            source_type=Reminder.SourceType.WARRANTY,
            status_value=Reminder.Status.PENDING,
            channel=Reminder.Channel.EMAIL,
        )
        self.create_reminder(
            title="Lisans sent in app",
            due_date=today,
            threshold_days=1,
            source_type=Reminder.SourceType.LICENSE,
            status_value=Reminder.Status.SENT,
            channel=Reminder.Channel.IN_APP,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/reminders/table/",
            {
                "source_type": Reminder.SourceType.WARRANTY,
                "status": Reminder.Status.PENDING,
                "channel": Reminder.Channel.EMAIL,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], expected.id)

    def test_reminder_table_visible_true_excludes_snoozed_today(self):
        today = timezone.localdate()

        visible = self.create_reminder(
            title="Görünür table reminder",
            due_date=today,
            threshold_days=1,
        )
        snoozed = self.create_reminder(
            title="Bugün gizlenen table reminder",
            due_date=today,
            threshold_days=1,
            snoozed_until=today,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/reminders/table/",
            {"visible": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = {item["id"] for item in response.data["results"]}

        self.assertIn(visible.id, ids)
        self.assertNotIn(snoozed.id, ids)

    def test_reminder_table_supports_snoozed_today_filter(self):
        today = timezone.localdate()

        snoozed = self.create_reminder(
            title="Bugün gizlenen filtre reminder",
            due_date=today,
            threshold_days=1,
            snoozed_until=today,
        )
        self.create_reminder(
            title="Normal reminder",
            due_date=today,
            threshold_days=1,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/reminders/table/",
            {"snoozed_today": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], snoozed.id)

    def test_reminder_table_supports_time_status_filter(self):
        today = timezone.localdate()

        overdue = self.create_reminder(
            title="Geciken table reminder",
            due_date=today - timezone.timedelta(days=1),
            threshold_days=1,
        )
        self.create_reminder(
            title="Bugün table reminder",
            due_date=today,
            threshold_days=1,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/reminders/table/",
            {"time_status": "overdue"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], overdue.id)

    def test_reminder_table_supports_due_date_filters_and_ordering(self):
        today = timezone.localdate()

        first = self.create_reminder(
            title="Yakın due reminder",
            due_date=today + timezone.timedelta(days=7),
            threshold_days=7,
        )
        second = self.create_reminder(
            title="Uzak due reminder",
            due_date=today + timezone.timedelta(days=30),
            threshold_days=30,
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/reminders/table/",
            {
                "due_after": today,
                "ordering": "due_date",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = [item["id"] for item in response.data["results"]]

        self.assertLess(ids.index(first.id), ids.index(second.id))