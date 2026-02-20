from django.core.exceptions import ValidationError
from django.db import models


class VirtualDomain(models.Model):
    """Virtual domain model for mail server."""
    name = models.CharField(max_length=255, unique=True, help_text="Domain name (e.g., example.com)")

    class Meta:
        db_table = 'virtual_domains'
        managed = False  # Don't let Django manage existing table structure
        verbose_name = "Virtual Domain"
        verbose_name_plural = "Virtual Domains"

    def __str__(self):
        return self.name

    @property
    def user_count(self):
        """Returns the number of users in this domain."""
        return self.virtualuser_set.count()


class VirtualUser(models.Model):
    """Virtual user model for mail server."""
    domain = models.ForeignKey(VirtualDomain, on_delete=models.CASCADE, db_column='domain_id', help_text="Associated domain")
    email = models.CharField(max_length=255, unique=True, help_text="Full email address")
    password = models.CharField(max_length=255, help_text="SHA512-CRYPT hashed password")

    class Meta:
        db_table = 'virtual_users'
        managed = False  # Don't let Django manage existing table structure
        verbose_name = "Virtual User"
        verbose_name_plural = "Virtual Users"

    def __str__(self):
        return str(self.email)

    def clean(self):
        """Validate that email domain matches the selected domain."""
        if self.email and self.domain:
            email_domain = str(self.email).split('@')[1] if '@' in str(self.email) else ''
            if email_domain != self.domain.name:
                raise ValidationError(f"Email domain '{email_domain}' must match selected domain '{self.domain.name}'")