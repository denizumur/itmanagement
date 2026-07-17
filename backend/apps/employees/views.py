import csv
from io import StringIO

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTechnicianOrAdminRole, IsViewerOrAboveRole
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log
from apps.common.pagination import StandardResultsPagination
from apps.employees.filters import EmployeeFilterSet
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeDetailSerializer, EmployeeListSerializer


EMPLOYEE_SEARCH_FIELDS = [
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

EMPLOYEE_ORDERING_FIELDS = [
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


def employee_base_queryset():
    return Employee.objects.select_related(
        "user",
        "user__profile",
        "department",
        "job_title",
        "manager",
    )


def apply_default_active_filter(queryset, query_params):
    if "is_active" not in query_params:
        return queryset.filter(is_active=True)

    return queryset


def apply_employee_filterset(queryset, query_params):
    filterset = EmployeeFilterSet(data=query_params, queryset=queryset)

    if not filterset.is_valid():
        return None, filterset.errors

    return filterset.qs, None


def apply_employee_search(queryset, search_value):
    normalized_search = (search_value or "").strip()

    if not normalized_search:
        return queryset

    search_query = Q()

    for field_name in EMPLOYEE_SEARCH_FIELDS:
        search_query |= Q(**{f"{field_name}__icontains": normalized_search})

    return queryset.filter(search_query)


def apply_employee_ordering(queryset, ordering_value):
    raw_ordering = (ordering_value or "full_name").strip()

    if not raw_ordering:
        return queryset.order_by("full_name")

    ordering_fields = []

    for item in raw_ordering.split(","):
        item = item.strip()

        if not item:
            continue

        descending = item.startswith("-")
        field_name = item[1:] if descending else item

        if field_name not in EMPLOYEE_ORDERING_FIELDS:
            continue

        ordering_fields.append(f"-{field_name}" if descending else field_name)

    if not ordering_fields:
        ordering_fields = ["full_name"]

    return queryset.order_by(*ordering_fields)


def get_filtered_employee_queryset_for_export(request):
    queryset = employee_base_queryset()
    queryset = apply_default_active_filter(queryset, request.query_params)

    queryset, errors = apply_employee_filterset(queryset, request.query_params)

    if errors:
        return None, errors

    queryset = apply_employee_search(
        queryset,
        request.query_params.get("search"),
    )
    queryset = apply_employee_ordering(
        queryset,
        request.query_params.get("ordering"),
    )

    return queryset, None


def get_export_filters_snapshot(query_params):
    ignored_keys = {"page", "page_size"}

    return {
        key: value
        for key, value in query_params.items()
        if key not in ignored_keys and value not in ["", None]
    }


def user_role(employee):
    profile = getattr(getattr(employee, "user", None), "profile", None)

    if not profile:
        return ""

    return profile.role


class EmployeeListAPIView(ListAPIView):
    """
    Legacy endpoint.

    Mevcut frontend akışlarını kırmamak için düz array response döndürmeye devam eder.
    Yeni tablo/pagination altyapısı için EmployeeTableListAPIView kullanılır.
    """

    serializer_class = EmployeeListSerializer
    permission_classes = [IsViewerOrAboveRole]

    def get_queryset(self):
        return employee_base_queryset().filter(is_active=True).order_by("full_name")


class EmployeeTableListAPIView(ListAPIView):
    """
    N7a table endpoint.

    Server-side pagination, search, filtering ve ordering destekler.
    """

    serializer_class = EmployeeListSerializer
    permission_classes = [IsViewerOrAboveRole]
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = EmployeeFilterSet

    search_fields = EMPLOYEE_SEARCH_FIELDS
    ordering_fields = EMPLOYEE_ORDERING_FIELDS
    ordering = ["full_name"]

    def get_queryset(self):
        queryset = employee_base_queryset().order_by("full_name")

        queryset = apply_default_active_filter(
            queryset,
            self.request.query_params,
        )

        return queryset


class EmployeeDetailAPIView(RetrieveAPIView):
    serializer_class = EmployeeDetailSerializer
    permission_classes = [IsViewerOrAboveRole]

    def get_queryset(self):
        return employee_base_queryset()


class EmployeeExportAPIView(APIView):
    permission_classes = [IsTechnicianOrAdminRole]

    def get(self, request):
        queryset, errors = get_filtered_employee_queryset_for_export(request)

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        row_count = queryset.count()
        today = timezone.localdate().isoformat()
        filename = f"personnel-export-{today}.csv"

        create_audit_log(
            request=request,
            action=AuditLog.Action.EXPORT,
            entity_type="employees.Employee",
            entity_id="",
            entity_repr="Employee CSV Export",
            metadata={
                "module": "employees",
                "operation": "employee_export",
                "format": "csv",
                "row_count": row_count,
                "filters": get_export_filters_snapshot(request.query_params),
            },
        )

        csv_buffer = StringIO(newline="")
        writer = csv.writer(csv_buffer)

        writer.writerow(
            [
                "ID",
                "Ad Soyad",
                "Personel Kodu",
                "E-posta",
                "Telefon",
                "Aktif Mi",
                "Departman",
                "Unvan",
                "Manager",
                "User Username",
                "User Email",
                "User Role",
                "Sync Source",
                "External HR ID",
                "Oluşturulma",
                "Güncellenme",
            ]
        )

        for employee in queryset:
            writer.writerow(
                [
                    employee.id,
                    employee.full_name,
                    employee.employee_code or "",
                    employee.email or "",
                    employee.phone or "",
                    "Evet" if employee.is_active else "Hayır",
                    employee.department.name if employee.department else "",
                    employee.job_title.name if employee.job_title else "",
                    employee.manager.full_name if employee.manager else "",
                    employee.user.username if employee.user else "",
                    employee.user.email if employee.user else "",
                    user_role(employee),
                    employee.sync_source,
                    employee.external_hr_id,
                    employee.created_at.isoformat() if employee.created_at else "",
                    employee.updated_at.isoformat() if employee.updated_at else "",
                ]
            )

        csv_bytes = csv_buffer.getvalue().encode("utf-8-sig")

        response = HttpResponse(
            csv_bytes,
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        return response