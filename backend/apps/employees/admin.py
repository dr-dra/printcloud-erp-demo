from django.contrib import admin
from .models import Employee

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'department', 'designation')
    search_fields = ('full_name', 'department', 'designation')
    list_filter = ('department', 'designation')
