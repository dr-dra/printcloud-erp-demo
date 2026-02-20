from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os


class LocalProfilePictureStorage(FileSystemStorage):
    """
    Custom storage class for employee profile pictures.
    Stores files locally in the media/profile_pictures/ directory.
    """
    def __init__(self):
        # Set up local storage specifically for profile pictures
        profile_media_root = os.path.join(settings.BASE_DIR, 'media', 'profile_pictures')
        super().__init__(location=profile_media_root, base_url='/media/profile_pictures/')
        
        # Ensure the directory exists
        os.makedirs(profile_media_root, exist_ok=True)