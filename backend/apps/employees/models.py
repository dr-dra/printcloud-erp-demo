import os

from django.db import models

from apps.users.models import User
from config.storage import LocalProfilePictureStorage


def profile_picture_upload_path(instance, filename):
    """Generate upload path for profile pictures"""
    # Get file extension
    ext = os.path.splitext(filename)[1]
    # Use user ID for organization and consistent naming
    return f'user_{instance.user.id}/profile_pic{ext}'


class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=150)
    profile_picture = models.ImageField(upload_to=profile_picture_upload_path, storage=LocalProfilePictureStorage(), blank=True, null=True, help_text='Local profile picture file')
    address = models.TextField()
    phone = models.CharField(max_length=15)
    emergency_contact = models.CharField(max_length=150)
    nic = models.CharField(max_length=12, unique=True)
    department = models.CharField(max_length=100)
    designation = models.CharField(max_length=100)
    date_of_joining = models.DateField()
    date_of_birth = models.DateField()
    bank_account_no = models.CharField(max_length=20)
    bank_name = models.CharField(max_length=100)
    legacy_id = models.IntegerField(null=True, blank=True, unique=True)
    
    def __str__(self):
        return self.full_name