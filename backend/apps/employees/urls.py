from django.urls import path

from apps.employees.views import (
    EmployeeDetailAPIView,
    EmployeeExportAPIView,
    EmployeeListAPIView,
    EmployeeTableListAPIView,
)

urlpatterns = [
    path("table/", EmployeeTableListAPIView.as_view(), name="employee-table-list"),
    path("export/", EmployeeExportAPIView.as_view(), name="employee-export"),
    path("<int:pk>/detail/", EmployeeDetailAPIView.as_view(), name="employee-detail"),
    path("", EmployeeListAPIView.as_view(), name="employee-list"),
]