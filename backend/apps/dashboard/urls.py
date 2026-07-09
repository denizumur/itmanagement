from django.urls import path

from apps.dashboard.views import DashboardOverviewView

urlpatterns = [
    path("overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
]