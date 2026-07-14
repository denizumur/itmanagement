from django.urls import path

from apps.employees.views import EmployeeListAPIView, EmployeeTableListAPIView

urlpatterns = [
    path("table/", EmployeeTableListAPIView.as_view(), name="employee-table-list"),
    path("", EmployeeListAPIView.as_view(), name="employee-list"),
]