from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.assignments.services import create_assignment_for_asset
from apps.accounts.permissions import ReadOnlyForViewerWriteForTechnician
from apps.assignments.models import Assignment
from apps.assignments.serializers import AssignmentSerializer
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, serialize_instance
from apps.inventory.models import Asset


ASSIGNMENT_AUDIT_EXCLUDE_FIELDS = (
    "created_at",
    "updated_at",
)


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError as exc:
            if "unique_active_assignment_per_asset" in str(exc):
                return Response(
                    {
                        "asset": [
                            "Bu varlık zaten aktif olarak zimmetli."
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            raise
    
    def get_queryset(self):
        queryset = Assignment.objects.select_related(
            "asset",
            "asset__category",
            "employee",
            "employee__department",
            "employee__job_title",
            "assigned_by",
            "returned_by",
        ).order_by("-assigned_at")

        active = self.request.query_params.get("active")
        asset_id = self.request.query_params.get("asset")
        employee_id = self.request.query_params.get("employee")
        search = self.request.query_params.get("search")

        if active == "true":
            queryset = queryset.filter(returned_at__isnull=True)
        elif active == "false":
            queryset = queryset.filter(returned_at__isnull=False)

        if asset_id:
            queryset = queryset.filter(asset_id=asset_id)

        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        if search:
            queryset = queryset.filter(
                Q(asset__name__icontains=search)
                | Q(asset__inventory_code__icontains=search)
                | Q(asset__serial_number__icontains=search)
                | Q(employee__full_name__icontains=search)
                | Q(employee__employee_code__icontains=search)
                | Q(notes__icontains=search)
                | Q(return_notes__icontains=search)
            )

        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        assignment = create_assignment_for_asset(
            asset=serializer.validated_data["asset"],
            employee=serializer.validated_data["employee"],
            assigned_at=serializer.validated_data.get("assigned_at"),
            notes=serializer.validated_data.get("notes", ""),
            assigned_by=self.request.user,
            request=self.request,
        )

        serializer.instance = assignment
        create_audit_log(
            request=self.request,
            action=AuditLog.Action.ASSIGN,
            instance=assignment,
            before={},
            after=serialize_instance(
                assignment,
                exclude=ASSIGNMENT_AUDIT_EXCLUDE_FIELDS,
            ),
            metadata={
                "module": "assignments",
                "operation": "assignment_create",
                "asset_id": assignment.asset_id,
                "employee_id": assignment.employee_id,
                "asset_status_before": asset_status_before,
                "asset_status_after": asset.status,
            },
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = self.get_object()

        before = serialize_instance(
            instance,
            exclude=ASSIGNMENT_AUDIT_EXCLUDE_FIELDS,
        )

        assignment = serializer.save()

        after = serialize_instance(
            assignment,
            exclude=ASSIGNMENT_AUDIT_EXCLUDE_FIELDS,
        )

        create_audit_log(
            request=self.request,
            action=AuditLog.Action.UPDATE,
            instance=assignment,
            before=before,
            after=after,
            skip_if_no_changes=True,
            metadata={
                "module": "assignments",
                "operation": "assignment_update",
                "asset_id": assignment.asset_id,
                "employee_id": assignment.employee_id,
            },
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Zimmet geçmişi silinemez. "
                    "Aktif zimmeti kapatmak için return endpointini kullan."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=["get"])
    def active(self, request):
        queryset = self.get_queryset().filter(returned_at__isnull=True)
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

    @action(
        detail=False,
        methods=["get"],
        url_path="by-employee/(?P<employee_id>[^/.]+)",
    )
    def by_employee(self, request, employee_id=None):
        queryset = self.get_queryset().filter(employee_id=employee_id)
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)

    @transaction.atomic
    @action(detail=True, methods=["post"], url_path="return")
    def return_asset(self, request, pk=None):
        assignment = self.get_object()

        if assignment.returned_at:
            return Response(
                {"detail": "Bu zimmet zaten iade edilmiş."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        before = serialize_instance(
            assignment,
            exclude=ASSIGNMENT_AUDIT_EXCLUDE_FIELDS,
        )

        return_notes = request.data.get("return_notes", "")

        assignment.returned_at = timezone.now()
        assignment.returned_by = request.user
        assignment.return_notes = return_notes
        assignment.save()

        asset = assignment.asset
        asset_status_before = asset.status

        asset.status = Asset.Status.IN_STOCK
        asset.updated_by = request.user
        asset.save(update_fields=["status", "updated_by", "updated_at"])

        after = serialize_instance(
            assignment,
            exclude=ASSIGNMENT_AUDIT_EXCLUDE_FIELDS,
        )

        create_audit_log(
            request=request,
            action=AuditLog.Action.RETURN,
            instance=assignment,
            before=before,
            after=after,
            metadata={
                "module": "assignments",
                "operation": "assignment_return",
                "asset_id": assignment.asset_id,
                "employee_id": assignment.employee_id,
                "asset_status_before": asset_status_before,
                "asset_status_after": asset.status,
            },
        )

        serializer = self.get_serializer(assignment)

        return Response(serializer.data)