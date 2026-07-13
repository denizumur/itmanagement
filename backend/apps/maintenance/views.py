from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import ReadOnlyForViewerWriteForTechnician
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, serialize_instance
from apps.inventory.models import Asset
from apps.maintenance.models import MaintenanceRecord
from apps.maintenance.serializers import MaintenanceRecordSerializer


MAINTENANCE_AUDIT_EXCLUDE_FIELDS = (
    "created_at",
    "updated_at",
)


def get_maintenance_create_audit_action(record):
    if record.type == MaintenanceRecord.Type.DISPOSAL:
        return AuditLog.Action.DISPOSE

    return AuditLog.Action.CREATE


def get_maintenance_create_operation(record):
    if record.type == MaintenanceRecord.Type.MAINTENANCE:
        return "maintenance_record_create"

    if record.type == MaintenanceRecord.Type.REPAIR:
        return "maintenance_repair_create"

    if record.type == MaintenanceRecord.Type.DISPOSAL:
        return "maintenance_disposal_create"

    return "maintenance_record_create"


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceRecordSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]

    def get_queryset(self):
        queryset = MaintenanceRecord.objects.select_related(
            "asset",
            "asset__category",
            "created_by",
            "updated_by",
        ).order_by("-performed_at", "-created_at")

        search = self.request.query_params.get("search")
        asset_id = self.request.query_params.get("asset")
        record_type = self.request.query_params.get("type")
        overdue = self.request.query_params.get("overdue")

        if asset_id:
            queryset = queryset.filter(asset_id=asset_id)

        if record_type:
            queryset = queryset.filter(type=record_type)

        if overdue == "true":
            queryset = queryset.filter(
                next_due_date__lt=timezone.localdate(),
            )

        if overdue == "false":
            queryset = queryset.filter(
                Q(next_due_date__isnull=True)
                | Q(next_due_date__gte=timezone.localdate())
            )

        if search:
            queryset = queryset.filter(
                Q(asset__name__icontains=search)
                | Q(asset__inventory_code__icontains=search)
                | Q(asset__serial_number__icontains=search)
                | Q(performed_by__icontains=search)
                | Q(description__icontains=search)
            )

        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        asset = serializer.validated_data["asset"]
        asset_status_before = asset.status

        record = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
            asset_status_before=asset_status_before,
        )

        self.apply_asset_effect(record)

        record.refresh_from_db()
        record.asset.refresh_from_db()

        create_audit_log(
            request=self.request,
            action=get_maintenance_create_audit_action(record),
            instance=record,
            before={},
            after=serialize_instance(
                record,
                exclude=MAINTENANCE_AUDIT_EXCLUDE_FIELDS,
            ),
            metadata={
                "module": "maintenance",
                "operation": get_maintenance_create_operation(record),
                "record_type": record.type,
                "asset_id": record.asset_id,
                "asset_status_before": asset_status_before,
                "asset_status_after": record.asset.status,
            },
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = self.get_object()

        before = serialize_instance(
            instance,
            exclude=MAINTENANCE_AUDIT_EXCLUDE_FIELDS,
        )

        record = serializer.save(updated_by=self.request.user)
        asset_status_before = record.asset.status

        self.apply_asset_effect(record)

        record.refresh_from_db()
        record.asset.refresh_from_db()

        after = serialize_instance(
            record,
            exclude=MAINTENANCE_AUDIT_EXCLUDE_FIELDS,
        )

        create_audit_log(
            request=self.request,
            action=AuditLog.Action.UPDATE,
            instance=record,
            before=before,
            after=after,
            skip_if_no_changes=True,
            metadata={
                "module": "maintenance",
                "operation": "maintenance_record_update",
                "record_type": record.type,
                "asset_id": record.asset_id,
                "asset_status_before": asset_status_before,
                "asset_status_after": record.asset.status,
            },
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Bakım/onarım geçmişi silinemez. "
                    "Hatalı kayıtlar için ileride düzeltme/audit akışı kullanılacak."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def apply_asset_effect(self, record):
        asset = record.asset
        update_fields = ["updated_by", "updated_at"]

        asset.updated_by = self.request.user

        if record.type == MaintenanceRecord.Type.MAINTENANCE:
            asset.maintenance_enabled = True
            update_fields.append("maintenance_enabled")

            if record.frequency_days:
                asset.maintenance_frequency_days = record.frequency_days
                update_fields.append("maintenance_frequency_days")

            if record.next_due_date:
                asset.next_maintenance_due_date = record.next_due_date
                update_fields.append("next_maintenance_due_date")

            if record.asset_status_after:
                asset.status = record.asset_status_after
                update_fields.append("status")

        elif record.type == MaintenanceRecord.Type.REPAIR:
            if record.asset_status_after:
                asset.status = record.asset_status_after
            else:
                has_active_assignment = asset.assignments.filter(
                    returned_at__isnull=True
                ).exists()
                asset.status = (
                    Asset.Status.ASSIGNED
                    if has_active_assignment
                    else Asset.Status.ACTIVE
                )

            update_fields.append("status")

        elif record.type == MaintenanceRecord.Type.DISPOSAL:
            asset.status = Asset.Status.DISPOSED
            asset.maintenance_enabled = False
            asset.next_maintenance_due_date = None

            update_fields.extend(
                [
                    "status",
                    "maintenance_enabled",
                    "next_maintenance_due_date",
                ]
            )

        asset.save(update_fields=list(set(update_fields)))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        today = timezone.localdate()

        data = {
            "total": queryset.count(),
            "by_type": list(
                queryset.values("type").annotate(count=Count("id")).order_by("type")
            ),
            "total_cost": queryset.aggregate(total=Sum("cost"))["total"] or 0,
            "overdue_next_due": queryset.filter(
                next_due_date__lt=today,
            ).count(),
            "upcoming_30_days": queryset.filter(
                next_due_date__gte=today,
                next_due_date__lte=today + timezone.timedelta(days=30),
            ).count(),
        }

        return Response(data)

    @action(detail=False, methods=["get"])
    def overdue(self, request):
        queryset = self.get_queryset().filter(
            next_due_date__lt=timezone.localdate(),
        )
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        today = timezone.localdate()
        days = int(request.query_params.get("days", 30))

        queryset = self.get_queryset().filter(
            next_due_date__gte=today,
            next_due_date__lte=today + timezone.timedelta(days=days),
        )
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="by-asset/(?P<asset_id>[^/.]+)",
    )
    def by_asset(self, request, asset_id=None):
        queryset = self.get_queryset().filter(asset_id=asset_id)
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)