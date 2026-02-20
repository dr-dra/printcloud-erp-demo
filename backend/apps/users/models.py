from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('production', 'Production'),
        ('designer', 'Designer/Typesetter'),
        ('accounting', 'Accounting/Cashier'),
    )
    THEME_CHOICES = (
        ('light', 'Light'),
        ('dark', 'Dark'),
    )
    SIDEBAR_BEHAVIOR_CHOICES = (
        ('overlay', 'Overlay'),
        ('push', 'Push Content'),
    )

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='production')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='dark')
    sidebar_behavior = models.CharField(max_length=10, choices=SIDEBAR_BEHAVIOR_CHOICES, default='overlay')

    # Printer preferences
    default_a4_printer = models.CharField(max_length=255, blank=True, null=True, help_text='Default printer for A4 documents (quotations, invoices, orders, job tickets)')
    default_a5_printer = models.CharField(max_length=255, blank=True, null=True, help_text='Default printer for A5 documents (dispatch notes, payment receipts)')
    default_pos_printer = models.CharField(max_length=255, blank=True, null=True, help_text='Default thermal printer for POS receipts')
    
    # UI preferences
    grid_rows_per_page = models.IntegerField(blank=True, null=True, help_text='Number of rows to display per page in grid views (1-100, null for auto)')
    
    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

    def get_full_name(self):
        """Return the employee first name, or username, or email. (Standardized for Grid views)"""
        try:
            if hasattr(self, 'employee') and self.employee and self.employee.full_name:
                return self.employee.full_name.split()[0]
        except Exception:
            pass
        
        if self.username:
            return self.username
        return self.email

    def get_complete_name(self):
        """Return the complete employee full name, or username, or email."""
        try:
            if hasattr(self, 'employee') and self.employee and self.employee.full_name:
                return self.employee.full_name
        except Exception:
            pass
        
        if self.username:
            return self.username
        return self.email

    def get_short_name(self):
        """Return the short name for the user."""
        return self.get_full_name()
