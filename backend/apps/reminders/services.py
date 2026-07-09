from dataclasses import dataclass
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import Asset
from apps.licensing.models import LicenseSubscription
from apps.reminders.models import Reminder


DEFAULT_THRESHOLDS = [30, 15, 7, 1]


@dataclass
class ReminderCandidate:
    source_type: str
    source_id: int
    title: str
    message: str
    due_date: object
    metadata: dict


class ReminderGenerationService:
    def __init__(self, thresholds: Iterable[int] | None = None):
        self.thresholds = list(thresholds or DEFAULT_THRESHOLDS)

    @transaction.atomic
    def generate_all(self, channel=Reminder.Channel.IN_APP, created_by=None):
        created_count = 0
        existing_count = 0
        cancelled_count = 0

        candidates = [
            *self.get_warranty_candidates(),
            *self.get_maintenance_candidates(),
            *self.get_license_candidates(),
        ]

        for candidate in candidates:
            cancelled_count += self.cancel_stale_pending_reminders(candidate, channel)

            for threshold_days in self.thresholds:
                scheduled_for = candidate.due_date - timezone.timedelta(
                    days=threshold_days
                )

                reminder, created = Reminder.objects.get_or_create(
                    source_type=candidate.source_type,
                    source_id=candidate.source_id,
                    due_date=candidate.due_date,
                    threshold_days=threshold_days,
                    channel=channel,
                    defaults={
                        "title": candidate.title,
                        "message": candidate.message,
                        "scheduled_for": scheduled_for,
                        "status": Reminder.Status.PENDING,
                        "metadata": candidate.metadata,
                        "created_by": created_by,
                    },
                )

                if created:
                    created_count += 1
                else:
                    existing_count += 1

                    changed = False

                    if reminder.title != candidate.title:
                        reminder.title = candidate.title
                        changed = True

                    if reminder.message != candidate.message:
                        reminder.message = candidate.message
                        changed = True

                    if reminder.metadata != candidate.metadata:
                        reminder.metadata = candidate.metadata
                        changed = True

                    if reminder.scheduled_for != scheduled_for:
                        reminder.scheduled_for = scheduled_for
                        changed = True

                    if changed:
                        reminder.save()

        return {
            "candidates": len(candidates),
            "created": created_count,
            "existing": existing_count,
            "cancelled_stale": cancelled_count,
            "thresholds": self.thresholds,
            "channel": channel,
        }

    def cancel_stale_pending_reminders(self, candidate, channel):
        qs = Reminder.objects.filter(
            source_type=candidate.source_type,
            source_id=candidate.source_id,
            channel=channel,
            status=Reminder.Status.PENDING,
        ).exclude(due_date=candidate.due_date)

        count = qs.count()

        if count:
            qs.update(
                status=Reminder.Status.CANCELLED,
                cancelled_at=timezone.now(),
            )

        return count

    def get_warranty_candidates(self):
        assets = Asset.objects.filter(
            warranty_end_date__isnull=False,
        ).select_related("category")

        candidates = []

        for asset in assets:
            candidates.append(
                ReminderCandidate(
                    source_type=Reminder.SourceType.WARRANTY,
                    source_id=asset.id,
                    title=f"Garanti bitişi yaklaşıyor: {asset.name}",
                    message=(
                        f"{asset.name} varlığının garanti bitiş tarihi "
                        f"{asset.warranty_end_date}. "
                        "Garanti yenileme/değişim kontrolü yapılmalı."
                    ),
                    due_date=asset.warranty_end_date,
                    metadata={
                        "asset_id": asset.id,
                        "asset_name": asset.name,
                        "inventory_code": asset.inventory_code,
                        "serial_number": asset.serial_number,
                        "category": asset.category.name if asset.category else None,
                        "source_model": "Asset",
                        "source_field": "warranty_end_date",
                    },
                )
            )

        return candidates

    def get_maintenance_candidates(self):
        assets = Asset.objects.filter(
            maintenance_enabled=True,
            next_maintenance_due_date__isnull=False,
        ).select_related("category")

        candidates = []

        for asset in assets:
            candidates.append(
                ReminderCandidate(
                    source_type=Reminder.SourceType.MAINTENANCE,
                    source_id=asset.id,
                    title=f"Bakım tarihi yaklaşıyor: {asset.name}",
                    message=(
                        f"{asset.name} varlığının sonraki bakım tarihi "
                        f"{asset.next_maintenance_due_date}. "
                        "Periyodik bakım planlanmalı."
                    ),
                    due_date=asset.next_maintenance_due_date,
                    metadata={
                        "asset_id": asset.id,
                        "asset_name": asset.name,
                        "inventory_code": asset.inventory_code,
                        "serial_number": asset.serial_number,
                        "category": asset.category.name if asset.category else None,
                        "source_model": "Asset",
                        "source_field": "next_maintenance_due_date",
                    },
                )
            )

        return candidates

    def get_license_candidates(self):
        subscriptions = LicenseSubscription.objects.filter(
            is_active=True,
            end_date__isnull=False,
        ).select_related("assigned_asset")

        candidates = []

        for subscription in subscriptions:
            candidates.append(
                ReminderCandidate(
                    source_type=Reminder.SourceType.LICENSE,
                    source_id=subscription.id,
                    title=f"Lisans/abonelik bitişi yaklaşıyor: {subscription.name}",
                    message=(
                        f"{subscription.name} kaydının bitiş/yenileme tarihi "
                        f"{subscription.end_date}. "
                        "Yenileme maliyeti ve aktif kullanım kontrol edilmeli."
                    ),
                    due_date=subscription.end_date,
                    metadata={
                        "license_id": subscription.id,
                        "name": subscription.name,
                        "tracking_code": subscription.tracking_code,
                        "vendor": subscription.vendor,
                        "seat_count": subscription.seat_count,
                        "renewal_cost": str(subscription.renewal_cost)
                        if subscription.renewal_cost is not None
                        else None,
                        "auto_renew": subscription.auto_renew,
                        "assigned_asset_id": subscription.assigned_asset_id,
                        "assigned_asset_name": subscription.assigned_asset.name
                        if subscription.assigned_asset
                        else None,
                        "source_model": "LicenseSubscription",
                        "source_field": "end_date",
                    },
                )
            )

        return candidates