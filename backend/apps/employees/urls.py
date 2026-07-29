from django.urls import path

from apps.employees.views import (
    EmployeeDetailAPIView,
    EmployeeExcelExportAPIView,
    EmployeeExportAPIView,
    EmployeeImportCommitAPIView,
    EmployeeImportDryRunAPIView,
    EmployeeListAPIView,
    EmployeeTableListAPIView,
)

urlpatterns = [
    path("table/", EmployeeTableListAPIView.as_view(), name="employee-table-list"),
    path("import/dry-run/", EmployeeImportDryRunAPIView.as_view(), name="employee-import-dry-run"),
    path("import/commit/", EmployeeImportCommitAPIView.as_view(), name="employee-import-commit"),
    path("export.xlsx/", EmployeeExcelExportAPIView.as_view(), name="employee-excel-export"),
    path("export/", EmployeeExportAPIView.as_view(), name="employee-export"),
    path("<int:pk>/detail/", EmployeeDetailAPIView.as_view(), name="employee-detail"),
    path("", EmployeeListAPIView.as_view(), name="employee-list"),
]
