from rest_framework_simplejwt.views import TokenObtainPairView

from .auth_serializers import LoginAlertTokenObtainPairSerializer


class LoginAlertTokenObtainPairView(TokenObtainPairView):
    serializer_class = LoginAlertTokenObtainPairSerializer
