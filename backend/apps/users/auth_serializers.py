import logging

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .login_alerts import send_login_alert

logger = logging.getLogger(__name__)


class LoginAlertTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT pair serializer that also emits login alert on successful authentication.
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        request = self.context.get('request')
        try:
            send_login_alert(self.user, request, login_method='password')
        except Exception:
            logger.exception('Failed to process login alert in JWT serializer')
        return data
