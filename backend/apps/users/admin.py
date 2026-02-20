from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    model = User
    list_display = ('email', 'username', 'is_active', 'is_staff', 'role')
    readonly_fields = ('date_joined',)  # 🛠️ Make date_joined readonly

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('username',)}),
        (_('Permissions'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Important dates'), {'fields': ('last_login',)}),  # ⬅️ removed date_joined
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'username', 'role', 'is_active', 'is_staff')}
        ),
    )
    search_fields = ('email', 'username')
    ordering = ('email',)
