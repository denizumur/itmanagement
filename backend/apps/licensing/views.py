from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import ReadOnlyForViewerWriteForTechnician
from apps.licensing.models import LicenseSubscription
from apps.licensing.serializers import LicenseSubscriptionSerializer


class LicenseSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = LicenseSubscriptionSerializer
    permission_classes = [ReadOnlyForViewerWriteForTechnician]

    def get_queryset(self):
        queryset = LicenseSubscription.objects.select_related(
            "assigned_asset",
            "created_by",
            "updated_by",
        ).order_by("end_date", "name")

        search = self.request.query_params.get("search")
        license_type = self.request.query_params.get("type")
        vendor = self.request.query_params.get("vendor")
        assigned_asset = self.request.query_params.get("assigned_asset")
        expired = self.request.query_params.get("expired")
        upcoming = self.request.query_params.get("upcoming")
        is_active = self.request.query_params.get("is_active")

        today = timezone.localdate()

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(tracking_code__icontains=search)
                | Q(vendor__icontains=search)
                | Q(license_key_masked__icontains=search)
                | Q(assigned_asset__name__icontains=search)
                | Q(assigned_asset__inventory_code__icontains=search)
                | Q(notes__icontains=search)
            )

        if license_type:
            queryset = queryset.filter(type=license_type)

        if vendor:
            queryset = queryset.filter(vendor__icontains=vendor)

        if assigned_asset:
            queryset = queryset.filter(assigned_asset_id=assigned_asset)

        if is_active == "true":
            queryset = queryset.filter(is_active=True)
        elif is_active == "false":
            queryset = queryset.filter(is_active=False)

        if expired == "true":
            queryset = queryset.filter(end_date__lt=today)
        elif expired == "false":
            queryset = queryset.filter(Q(end_date__isnull=True) | Q(end_date__gte=today))

        if upcoming == "true":
            queryset = queryset.filter(
                end_date__gte=today,
                end_date__lte=today + timezone.timedelta(days=30),
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        subscription = self.get_object()
        subscription.soft_delete(user=request.user)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        subscription = LicenseSubscription.all_objects.filter(pk=pk).first()

        if not subscription:
            return Response(
                {"detail": "Lisans/abonelik bulunamadı."},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscription.restore(user=request.user)

        serializer = self.get_serializer(subscription)

        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        today = timezone.localdate()

        upcoming_30_qs = queryset.filter(
            is_active=True,
            end_date__gte=today,
            end_date__lte=today + timezone.timedelta(days=30),
        )

        expired_qs = queryset.filter(
            is_active=True,
            end_date__lt=today,
        )

        data = {
            "total": queryset.count(),
            "active": queryset.filter(is_active=True).count(),
            "expired": expired_qs.count(),
            "upcoming_30_days": upcoming_30_qs.count(),
            "auto_renew": queryset.filter(is_active=True, auto_renew=True).count(),
            "total_seats": queryset.filter(is_active=True).aggregate(
                total=Sum("seat_count")
            )["total"]
            or 0,
            "upcoming_30_days_renewal_cost": upcoming_30_qs.aggregate(
                total=Sum("renewal_cost")
            )["total"]
            or 0,
            "by_type": list(
                queryset.values("type").annotate(count=Count("id")).order_by("type")
            ),
            "by_vendor": list(
                queryset.values("vendor")
                .annotate(count=Count("id"))
                .order_by("vendor")
            ),
        }

        return Response(data)

    @action(detail=False, methods=["get"])
    def expired(self, request):
        queryset = self.get_queryset().filter(
            is_active=True,
            end_date__lt=timezone.localdate(),
        )
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        today = timezone.localdate()
        days = int(request.query_params.get("days", 30))

        queryset = self.get_queryset().filter(
            is_active=True,
            end_date__gte=today,
            end_date__lte=today + timezone.timedelta(days=days),
        )
        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)