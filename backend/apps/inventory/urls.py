from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.inventory.views import (
    AssetCategoryViewSet,
    AssetTableListAPIView,
    AssetViewSet,
)

router = DefaultRouter()
router.register("categories", AssetCategoryViewSet, basename="inventory-category")
router.register("assets", AssetViewSet, basename="inventory-asset")

urlpatterns = [
    path("assets/table/", AssetTableListAPIView.as_view(), name="inventory-asset-table"),
    *router.urls,
]