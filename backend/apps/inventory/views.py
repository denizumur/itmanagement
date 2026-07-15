from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView

from apps.common.pagination import StandardResultsPagination
from apps.inventory.filters import AssetFilterSet
from apps.accounts.permissions import ReadOnlyForViewerWriteForTechnician
from apps.assignments.serializers import AssignmentSerializer
from apps.assignments.services import create_assignment_for_asset
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, serialize_instance
from apps.inventory.models import Asset, AssetCategory
from apps.inventory.serializers import AssetCategorySerializer, AssetSerializer
ASSET_AUDIT_EXCLUDE_FIELDS = (
    "created_at",
    "updated_at",
)

def asset_base_queryset():
    return Asset.objects.select_related(
        "category",
        "created_by",
        "updated_by",
    )
class AssetCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = AssetCategorySerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]

    def get_queryset(self):
        queryset = AssetCategory.objects.annotate(
            asset_count=Count(
                "assets",
                filter=Q(assets__is_deleted=False),
            )
        ).order_by("display_order", "name")

        is_active = self.request.query_params.get("is_active")

        if is_active == "true":
            queryset = queryset.filter(is_active=True)
        elif is_active == "false":
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

class AssetTableListAPIView(ListAPIView):
    serializer_class = AssetSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = AssetFilterSet

    search_fields = [
        "name",
        "brand",
        "model",
        "serial_number",
        "inventory_code",
        "location",
        "ip_address",
        "mac_address",
        "vendor_name",
        "notes",
        "category__name",
    ]

    ordering_fields = [
        "name",
        "brand",
        "model",
        "serial_number",
        "inventory_code",
        "status",
        "location",
        "warranty_end_date",
        "next_maintenance_due_date",
        "created_at",
        "updated_at",
        "category__name",
    ]

    ordering = ["name"]

    def get_queryset(self):
        return asset_base_queryset().order_by("name")
class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]

    def get_queryset(self):
        queryset = asset_base_queryset().order_by("name")

        search = self.request.query_params.get("search")
        category_id = self.request.query_params.get("category")
        status_value = self.request.query_params.get("status")
        location = self.request.query_params.get("location")
        maintenance_overdue = self.request.query_params.get("maintenance_overdue")
        warranty_expired = self.request.query_params.get("warranty_expired")

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(brand__icontains=search)
                | Q(model__icontains=search)
                | Q(serial_number__icontains=search)
                | Q(inventory_code__icontains=search)
                | Q(location__icontains=search)
                | Q(ip_address__icontains=search)
                | Q(mac_address__icontains=search)
                | Q(vendor_name__icontains=search)
                | Q(notes__icontains=search)
            )

        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if status_value:
            queryset = queryset.filter(status=status_value)

        if location:
            queryset = queryset.filter(location__icontains=location)

        if maintenance_overdue == "true":
            from django.utils import timezone

            queryset = queryset.filter(
                maintenance_enabled=True,
                next_maintenance_due_date__lt=timezone.localdate(),
            )

        if warranty_expired == "true":
            from django.utils import timezone

            queryset = queryset.filter(
                warranty_end_date__lt=timezone.localdate(),
            )

        return queryset
    
    def create_asset_audit_log(self, asset, operation="asset_create"):
        create_audit_log(
            request=self.request,
            action=AuditLog.Action.CREATE,
            instance=asset,
            before={},
            after=serialize_instance(
                asset,
                exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
            ),
            metadata={
                "module": "inventory",
                "operation": operation,
            },
        )
    def perform_create(self, serializer):
        asset = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

        create_audit_log(
            request=self.request,
            action=AuditLog.Action.CREATE,
            instance=asset,
            before={},
            after=serialize_instance(
                asset,
                exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
            ),
            metadata={
                "module": "inventory",
                "operation": "asset_create",
            },
        )

    def perform_update(self, serializer):
        instance = self.get_object()

        before = serialize_instance(
            instance,
            exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
        )

        asset = serializer.save(
            updated_by=self.request.user,
        )

        after = serialize_instance(
            asset,
            exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
        )

        create_audit_log(
            request=self.request,
            action=AuditLog.Action.UPDATE,
            instance=asset,
            before=before,
            after=after,
            skip_if_no_changes=True,
            metadata={
                "module": "inventory",
                "operation": "asset_update",
            },
        )
    def destroy(self, request, *args, **kwargs):
        asset = self.get_object()

        before = serialize_instance(
            asset,
            exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
        )

        asset.soft_delete(user=request.user)

        after = serialize_instance(
            asset,
            exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
        )

        create_audit_log(
            request=request,
            action=AuditLog.Action.DELETE,
            instance=asset,
            before=before,
            after=after,
            metadata={
                "module": "inventory",
                "operation": "asset_soft_delete",
            },
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @transaction.atomic
    @action(detail=False, methods=["post"], url_path="create-with-assignment")
    def create_with_assignment(self, request):
        asset_payload = request.data.get("asset")
        assignment_payload = request.data.get("assignment")

        if not isinstance(asset_payload, dict):
            return Response(
                {"asset": "asset alanı zorunlu ve object tipinde olmalıdır."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(assignment_payload, dict):
            return Response(
                {
                    "assignment": (
                        "assignment alanı zorunlu ve object tipinde olmalıdır."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        asset_serializer = self.get_serializer(data=asset_payload)
        asset_serializer.is_valid(raise_exception=True)

        asset = asset_serializer.save(
            created_by=request.user,
            updated_by=request.user,
        )

        self.create_asset_audit_log(
            asset,
            operation="asset_create_with_assignment",
        )

        assignment_data = {
            **assignment_payload,
            "asset": asset.id,
        }

        assignment_serializer = AssignmentSerializer(
            data=assignment_data,
            context={"request": request},
        )
        assignment_serializer.is_valid(raise_exception=True)

        assignment = create_assignment_for_asset(
            asset=asset,
            employee=assignment_serializer.validated_data["employee"],
            assigned_at=assignment_serializer.validated_data.get("assigned_at"),
            notes=assignment_serializer.validated_data.get("notes", ""),
            assigned_by=request.user,
            request=request,
        )

        asset_serializer = self.get_serializer(asset)
        assignment_serializer = AssignmentSerializer(
            assignment,
            context={"request": request},
        )

        return Response(
            {
                "asset": asset_serializer.data,
                "assignment": assignment_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )
    
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        asset = Asset.all_objects.filter(pk=pk).first()

        if not asset:
            return Response(
                {"detail": "Varlık bulunamadı."},
                status=status.HTTP_404_NOT_FOUND,
            )

        before = serialize_instance(
            asset,
            exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
        )

        try:
            with transaction.atomic():
                asset.restore(user=request.user)

                after = serialize_instance(
                    asset,
                    exclude=ASSET_AUDIT_EXCLUDE_FIELDS,
                )

                create_audit_log(
                    request=request,
                    action=AuditLog.Action.RESTORE,
                    instance=asset,
                    before=before,
                    after=after,
                    metadata={
                        "module": "inventory",
                        "operation": "asset_restore",
                    },
                )
        except IntegrityError as exc:
            if (
                "unique_active_asset_serial_number" in str(exc)
                or "unique_active_asset_inventory_code" in str(exc)
            ):
                return Response(
                    {
                        "detail": (
                            "Bu seri numarası veya envanter kodu aktif başka "
                            "bir varlıkta kullanılıyor. Geri yükleme yapılamadı."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            raise

        serializer = self.get_serializer(asset)

        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()

        from django.utils import timezone

        today = timezone.localdate()

        data = {
            "total": queryset.count(),
            "by_status": list(
                queryset.values("status").annotate(count=Count("id")).order_by("status")
            ),
            "by_category": list(
                queryset.values("category__name")
                .annotate(count=Count("id"))
                .order_by("category__name")
            ),
            "maintenance_overdue": queryset.filter(
                maintenance_enabled=True,
                next_maintenance_due_date__lt=today,
            ).count(),
            "maintenance_upcoming_30_days": queryset.filter(
                maintenance_enabled=True,
                next_maintenance_due_date__gte=today,
                next_maintenance_due_date__lte=today + timezone.timedelta(days=30),
            ).count(),
            "warranty_expired": queryset.filter(
                warranty_end_date__lt=today,
            ).count(),
            "warranty_upcoming_30_days": queryset.filter(
                warranty_end_date__gte=today,
                warranty_end_date__lte=today + timezone.timedelta(days=30),
            ).count(),
        }

        return Response(data)