from django.urls import path

from apps.employees.views import EmployeeListAPIView

urlpatterns = [
    path("", EmployeeListAPIView.as_view(), name="employee-list"),
]