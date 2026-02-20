from django.urls import path, include
from .views import UserProfileView, upload_profile_picture, change_password, user_profile_summary, crop_profile_picture_server

urlpatterns = [
    # Our specific profile routes first
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/upload-picture/', upload_profile_picture,
         name='upload-profile-picture'),
    path('profile/change-password/', change_password, name='change-password'),
    path('profile/summary/', user_profile_summary, name='user-profile-summary'),
    path('profile/crop-picture/', crop_profile_picture_server, name='crop-profile-picture'),

    # Auth routes after
    path('', include('djoser.urls')),
    path('', include('djoser.urls.jwt')),
]
