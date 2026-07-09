from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsViewerOrAboveRole
from apps.assignments.models import Assignment
from apps.inventory.models import Asset
from apps.licensing.models import LicenseSubscription
from apps.reminders.models import Reminder


class DashboardOverviewView(APIView):
    permission_classes = [IsViewerOrAboveRole]

    @extend_schema(
        tags=["dashboard"],
        responses={
            200: OpenApiResponse(
                description="Genel bakış dashboard verisi."
            )
        },
    )
    def get(self, request):
        today = timezone.localdate()
        next_30_days = today + timedelta(days=30)

        assets_qs = Asset.objects.select_related("category")
        licenses_qs = LicenseSubscription.objects.select_related("assigned_asset")
        active_assignments_qs = Assignment.objects.filter(returned_at__isnull=True)
        pending_reminders_qs = Reminder.objects.filter(status=Reminder.Status.PENDING)

        total_assets = assets_qs.count()

        asset_status_counts = {
            row["status"]: row["count"]
            for row in assets_qs.values("status").annotate(count=Count("id"))
        }

        active_assignments = active_assignments_qs.count()

        maintenance_overdue = assets_qs.filter(
            maintenance_enabled=True,
            next_maintenance_due_date__lt=today,
        ).count()

        upcoming_maintenance = assets_qs.filter(
            maintenance_enabled=True,
            next_maintenance_due_date__gte=today,
            next_maintenance_due_date__lte=next_30_days,
        ).count()

        warranty_expired = assets_qs.filter(
            warranty_end_date__lt=today,
        ).count()

        warranty_upcoming_30_days = assets_qs.filter(
            warranty_end_date__gte=today,
            warranty_end_date__lte=next_30_days,
        ).count()

        expired_licenses = licenses_qs.filter(
            is_active=True,
            end_date__lt=today,
        ).count()

        licenses_expiring_30_days = licenses_qs.filter(
            is_active=True,
            end_date__gte=today,
            end_date__lte=next_30_days,
        ).count()

        visible_pending_reminders = pending_reminders_qs.filter(
            scheduled_for__lte=today,
        ).count()

        # Ticket modülü henüz kurulmadı. Dashboard response shape şimdiden hazır.
        open_tickets = 0

        category_rows = list(
            assets_qs.values("category__name")
            .annotate(count=Count("id"))
            .order_by("category__display_order", "category__name")
        )

        asset_category_distribution = {
            "labels": [
                row["category__name"] or "Kategorisiz"
                for row in category_rows
            ],
            "counts": [
                row["count"]
                for row in category_rows
            ],
        }

        upcoming_license_list = []

        for license_item in (
            licenses_qs.filter(
                is_active=True,
                end_date__gte=today,
                end_date__lte=next_30_days,
            )
            .order_by("end_date", "name")[:8]
        ):
            days_left = (license_item.end_date - today).days

            if days_left <= 7:
                urgency = "danger"
            elif days_left <= 30:
                urgency = "warning"
            else:
                urgency = "success"

            upcoming_license_list.append(
                {
                    "id": license_item.id,
                    "name": license_item.name,
                    "vendor": license_item.vendor,
                    "tracking_code": license_item.tracking_code,
                    "end_date": license_item.end_date,
                    "days_left": days_left,
                    "urgency": urgency,
                    "renewal_cost": license_item.renewal_cost,
                    "auto_renew": license_item.auto_renew,
                }
            )

        attention_assets = self.get_attention_assets(
            assets_qs=assets_qs,
            today=today,
            next_30_days=next_30_days,
        )

        data = {
            "generated_at": timezone.now(),
            "period": {
                "today": today,
                "next_30_days": next_30_days,
            },
            "metrics": {
                "total_assets": total_assets,
                "active_assets": asset_status_counts.get(Asset.Status.ACTIVE, 0),
                "assigned_assets": asset_status_counts.get(Asset.Status.ASSIGNED, 0),
                "in_stock_assets": asset_status_counts.get(Asset.Status.IN_STOCK, 0),
                "in_repair_assets": asset_status_counts.get(Asset.Status.IN_REPAIR, 0),
                "faulty_assets": asset_status_counts.get(Asset.Status.FAULTY, 0),
                "disposed_assets": asset_status_counts.get(Asset.Status.DISPOSED, 0),
                "lost_assets": asset_status_counts.get(Asset.Status.LOST, 0),
                "active_assignments": active_assignments,
                "maintenance_overdue": maintenance_overdue,
                "upcoming_maintenance": upcoming_maintenance,
                "warranty_expired": warranty_expired,
                "warranty_upcoming_30_days": warranty_upcoming_30_days,
                "expired_licenses": expired_licenses,
                "licenses_expiring_30_days": licenses_expiring_30_days,
                "visible_pending_reminders": visible_pending_reminders,
                "open_tickets": open_tickets,
            },
            "metric_cards": [
                {
                    "key": "total_assets",
                    "label": "Toplam varlık",
                    "value": total_assets,
                    "role": "accent",
                    "icon": "devices",
                },
                {
                    "key": "expired_licenses",
                    "label": "Süresi dolan lisans",
                    "value": expired_licenses,
                    "role": "danger",
                    "icon": "alert-triangle",
                },
                {
                    "key": "open_tickets",
                    "label": "Açık ticket",
                    "value": open_tickets,
                    "role": "warning",
                    "icon": "ticket",
                    "module_ready": False,
                },
                {
                    "key": "upcoming_maintenance",
                    "label": "Yaklaşan bakım",
                    "value": upcoming_maintenance,
                    "role": "success",
                    "icon": "tool",
                },
            ],
            "asset_status_counts": [
                {
                    "status": status_value,
                    "label": Asset.Status(status_value).label,
                    "count": count,
                }
                for status_value, count in asset_status_counts.items()
            ],
            "asset_category_distribution": asset_category_distribution,
            "upcoming_license_list": upcoming_license_list,
            "attention": {
                "maintenance_overdue": maintenance_overdue,
                "warranty_expired": warranty_expired,
                "licenses_expiring_30_days": licenses_expiring_30_days,
                "visible_pending_reminders": visible_pending_reminders,
                "assets": attention_assets,
            },
            "reminders": {
                "pending": pending_reminders_qs.count(),
                "visible_pending": visible_pending_reminders,
                "by_source_type": list(
                    pending_reminders_qs.values("source_type")
                    .annotate(count=Count("id"))
                    .order_by("source_type")
                ),
            },
        }

        return Response(data)

    def get_attention_assets(self, assets_qs, today, next_30_days):
        flagged_assets = []

        maintenance_assets = assets_qs.filter(
            maintenance_enabled=True,
        ).filter(
            Q(next_maintenance_due_date__lt=today)
            | Q(
                next_maintenance_due_date__gte=today,
                next_maintenance_due_date__lte=next_30_days,
            )
        ).order_by("next_maintenance_due_date")[:8]

        for asset in maintenance_assets:
            days_remaining = (
                asset.next_maintenance_due_date - today
            ).days

            flagged_assets.append(
                {
                    "id": asset.id,
                    "name": asset.name,
                    "inventory_code": asset.inventory_code,
                    "category": asset.category.name if asset.category else None,
                    "flag_type": "maintenance",
                    "flag_label": "Bakım gecikmiş"
                    if days_remaining < 0
                    else "Bakım yaklaşıyor",
                    "flag_level": "danger" if days_remaining < 0 else "warning",
                    "date": asset.next_maintenance_due_date,
                    "days_remaining": days_remaining,
                }
            )

        warranty_assets = assets_qs.filter(
            warranty_end_date__isnull=False,
        ).filter(
            Q(warranty_end_date__lt=today)
            | Q(
                warranty_end_date__gte=today,
                warranty_end_date__lte=next_30_days,
            )
        ).order_by("warranty_end_date")[:8]

        for asset in warranty_assets:
            days_remaining = (asset.warranty_end_date - today).days

            flagged_assets.append(
                {
                    "id": asset.id,
                    "name": asset.name,
                    "inventory_code": asset.inventory_code,
                    "category": asset.category.name if asset.category else None,
                    "flag_type": "warranty",
                    "flag_label": "Garanti bitmiş"
                    if days_remaining < 0
                    else "Garanti yaklaşıyor",
                    "flag_level": "danger" if days_remaining < 0 else "warning",
                    "date": asset.warranty_end_date,
                    "days_remaining": days_remaining,
                }
            )

        flagged_assets.sort(key=lambda item: item["days_remaining"])

        return flagged_assets[:10]