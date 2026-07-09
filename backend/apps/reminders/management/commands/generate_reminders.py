from django.core.management.base import BaseCommand

from apps.reminders.models import Reminder
from apps.reminders.services import ReminderGenerationService


class Command(BaseCommand):
    help = "Garanti, bakım ve lisans kaynaklarından hatırlatıcı kayıtları üretir."

    def add_arguments(self, parser):
        parser.add_argument(
            "--channel",
            default=Reminder.Channel.IN_APP,
            choices=[Reminder.Channel.IN_APP, Reminder.Channel.EMAIL],
        )

    def handle(self, *args, **options):
        channel = options["channel"]

        service = ReminderGenerationService()
        result = service.generate_all(channel=channel)

        self.stdout.write(
            self.style.SUCCESS(
                "Reminder generation tamamlandı. "
                f"Candidates: {result['candidates']}, "
                f"Created: {result['created']}, "
                f"Existing: {result['existing']}, "
                f"Cancelled stale: {result['cancelled_stale']}, "
                f"Channel: {result['channel']}"
            )
        )