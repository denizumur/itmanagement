from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.common.pagination import StandardResultsPagination
from apps.employees.filters import EmployeeFilterSet
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeListSerializer


def employee_base_queryset():
    return Employee.objects.select_related(
        "user",
        "user__profile",
        "department",
        "job_title",
        "manager",
    )


class EmployeeListAPIView(ListAPIView):
    """
    Legacy endpoint.

    Mevcut frontend akışlarını kırmamak için düz array response döndürmeye devam eder.
    Yeni tablo/pagination altyapısı için EmployeeTableListAPIView kullanılır.
    """

    serializer_class = EmployeeListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return employee_base_queryset().filter(is_active=True).order_by("full_name")


class EmployeeTableListAPIView(ListAPIView):
    """
    N7a pilot endpoint.

    Server-side pagination, search, filtering ve ordering destekler.
    Response shape:
    {
      "count": number,
      "next": string | null,
      "previous": string | null,
      "results": [...]
    }
    """

    serializer_class = EmployeeListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = EmployeeFilterSet

    search_fields = [
        "full_name",
        "email",
        "employee_code",
        "phone",
        "external_hr_id",
        "department__name",
        "job_title__name",
        "manager__full_name",
        "user__username",
        "user__email",
    ]

    ordering_fields = [
        "full_name",
        "email",
        "employee_code",
        "created_at",
        "updated_at",
        "is_active",
        "sync_source",
        "department__name",
        "job_title__name",
        "manager__full_name",
        "user__username",
    ]

    ordering = ["full_name"]

    def get_queryset(self):
        queryset = employee_base_queryset().order_by("full_name")

        # Güvenli pilot davranışı:
        # Eski endpoint gibi varsayılan olarak aktif personelleri göster.
        # Admin Console fazında pasifleri özellikle görmek istersek ?is_active=false
        # veya ?is_active=true ile açıkça filtrelenebilir.
        if "is_active" not in self.request.query_params:
            queryset = queryset.filter(is_active=True)

        return queryset