from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.assignments.views import AssignmentTableListAPIView, AssignmentViewSet

router = DefaultRouter()
router.register("assignments", AssignmentViewSet, basename="assignment")

urlpatterns = [
    path(
        "assignments/table/",
        AssignmentTableListAPIView.as_view(),
        name="assignment-table",
    ),
    *router.urls,
]