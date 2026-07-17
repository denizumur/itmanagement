from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.services import build_notification_center_response


class NotificationCenterAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = build_notification_center_response(request.user)
        return Response(data)