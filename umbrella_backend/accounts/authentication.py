from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone

from .models import UserManagement, AuthSession


class DashboardSessionAuthentication(BaseAuthentication):
    def authenticate(self, request):
        user_id = request.session.get("user_id")
        if not user_id:
            return None

        session_request_token = request.session.get("auth_session_request_token")
        if not session_request_token:
            request.session.flush()
            return None

        try:
            user = UserManagement.objects.get(id=user_id, is_active=True)
        except UserManagement.DoesNotExist:
            request.session.flush()
            raise AuthenticationFailed("Invalid session")

        auth_session = AuthSession.objects.filter(
            user=user,
            session_request_token=session_request_token,
            status="active",
            is_active=True,
        ).first()

        if not auth_session:
            request.session.flush()
            raise AuthenticationFailed("Invalid session")

        if auth_session.expires_at <= timezone.now():
            auth_session.is_active = False
            auth_session.status = "expired"
            auth_session.ended_at = timezone.now()
            auth_session.active_duration_seconds = max(
                0,
                int((auth_session.ended_at - auth_session.created_at).total_seconds()),
            )
            auth_session.save(
                update_fields=[
                    "is_active",
                    "status",
                    "ended_at",
                    "active_duration_seconds",
                ]
            )
            request.session.flush()
            raise AuthenticationFailed("Session expired")

        return (user, None)
