from rest_framework.routers import DefaultRouter

from apps.tickets.views import TicketViewSet

router = DefaultRouter()
router.register("", TicketViewSet, basename="tickets")

urlpatterns = router.urls