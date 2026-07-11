from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.employees.models import Employee
from apps.employees.serializers import EmployeeListSerializer


class EmployeeListAPIView(ListAPIView):
    serializer_class = EmployeeListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Employee.objects.select_related("department", "job_title")
            .filter(is_active=True)
            .order_by("full_name")
        )