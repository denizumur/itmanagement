from django.urls import path

from apps.employees.views import (
    EmployeeDetailAPIView,
    EmployeeExcelExportAPIView,
    EmployeeExportAPIView,
    EmployeeImportCommitAPIView,
    EmployeeImportDryRunAPIView,
    EmployeeImportErrorReportAPIView,
    EmployeeImportHistoryAPIView,
    EmployeeImportHistoryDetailAPIView,
    EmployeeListAPIView,
    EmployeeTableListAPIView,
)

urlpatterns = [
    path("table/", EmployeeTableListAPIView.as_view(), name="employee-table-list"),
    path("import/history/", EmployeeImportHistoryAPIView.as_view(), name="employee-import-history"),
    path("import/history/<int:pk>/", EmployeeImportHistoryDetailAPIView.as_view(), name="employee-import-history-detail"),
    path("import/<str:import_id>/errors.csv/", EmployeeImportErrorReportAPIView.as_view(), name="employee-import-error-report"),
    path("import/dry-run/", EmployeeImportDryRunAPIView.as_view(), name="employee-import-dry-run"),
    path("import/commit/", EmployeeImportCommitAPIView.as_view(), name="employee-import-commit"),
    path("export.xlsx/", EmployeeExcelExportAPIView.as_view(), name="employee-excel-export"),
    path("export/", EmployeeExportAPIView.as_view(), name="employee-export"),
    path("<int:pk>/detail/", EmployeeDetailAPIView.as_view(), name="employee-detail"),
    path("", EmployeeListAPIView.as_view(), name="employee-list"),
]
