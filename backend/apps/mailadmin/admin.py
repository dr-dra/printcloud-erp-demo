from django.contrib import admin, messages
from django.contrib.admin import AdminSite
from django.core.exceptions import PermissionDenied
from django.forms import ModelForm, PasswordInput

from .models import VirtualDomain, VirtualUser
from .utils import hash_password, is_password_hashed


class VirtualUserForm(ModelForm):
    """Custom form for VirtualUser with proper password handling."""
    
    class Meta:
        model = VirtualUser
        fields = '__all__'
        widgets = {
            'password': PasswordInput(render_value=False),  # Hide password in forms
        }


class VirtualDomainAdmin(admin.ModelAdmin):
    """Admin interface for Virtual Domains."""
    list_display = ('name', 'user_count')
    search_fields = ('name',)
    
    def user_count(self, obj):
        """Display number of users in this domain."""
        return VirtualUser.objects.using('mailserver').filter(domain=obj).count()
    user_count.short_description = 'Users'
    
    def delete_model(self, request, obj):
        """Prevent deletion if users exist in this domain."""
        user_count = VirtualUser.objects.using('mailserver').filter(domain=obj).count()
        if user_count > 0:
            messages.error(
                request, 
                f"Cannot delete domain '{obj.name}'. "
                f"Please delete all {user_count} user(s) first: "
                f"{', '.join(VirtualUser.objects.using('mailserver').filter(domain=obj).values_list('email', flat=True))}"
            )
            raise PermissionDenied("Domain has active users")
        
        super().delete_model(request, obj)
    
    def delete_queryset(self, request, queryset):
        """Prevent bulk deletion if any domains have users."""
        blocked_domains = []
        for domain in queryset:
            user_count = VirtualUser.objects.using('mailserver').filter(domain=domain).count()
            if user_count > 0:
                users = VirtualUser.objects.using('mailserver').filter(domain=domain).values_list('email', flat=True)
                blocked_domains.append(f"{domain.name} ({user_count} users: {', '.join(users)})")
        
        if blocked_domains:
            messages.error(
                request,
                f"Cannot delete domains with active users: {'; '.join(blocked_domains)}. "
                "Please delete all users first."
            )
            raise PermissionDenied("Some domains have active users")
        
        super().delete_queryset(request, queryset)


class VirtualUserAdmin(admin.ModelAdmin):
    """Admin interface for Virtual Users."""
    form = VirtualUserForm
    list_display = ('email', 'domain')
    list_filter = ('domain',)
    search_fields = ('email', 'domain__name')
    fields = ('email', 'domain', 'password')
    
    def save_model(self, request, obj, form, change):
        """Hash password on save if it was changed."""
        if 'password' in form.changed_data:
            # Only hash if it's not already hashed
            if not is_password_hashed(obj.password):
                obj.password = hash_password(obj.password)
        super().save_model(request, obj, form, change)


# Register models with default admin
admin.site.register(VirtualDomain, VirtualDomainAdmin)
admin.site.register(VirtualUser, VirtualUserAdmin)