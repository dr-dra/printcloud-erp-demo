import os

from django.conf import settings
from rest_framework import serializers

from .models import User
from apps.employees.models import Employee


class UserSerializer(serializers.ModelSerializer):
    printer_settings = serializers.SerializerMethodField()
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'full_name', 'role', 'theme',
                  'sidebar_behavior', 'grid_rows_per_page', 'printer_settings']

    def get_printer_settings(self, obj):
        return {
            'default_a4_printer': obj.default_a4_printer,
            'default_a5_printer': obj.default_a5_printer,
            'default_pos_printer': obj.default_pos_printer,
        }


class UserUpdateSerializer(serializers.ModelSerializer):
    printer_settings = serializers.DictField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'theme', 'sidebar_behavior',
                  'grid_rows_per_page', 'printer_settings']

    def update(self, instance, validated_data):
        printer_settings = validated_data.pop('printer_settings', None)

        # Update regular fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Update printer settings if provided
        if printer_settings:
            instance.default_a4_printer = printer_settings.get(
                'default_a4_printer', instance.default_a4_printer)
            instance.default_a5_printer = printer_settings.get(
                'default_a5_printer', instance.default_a5_printer)
            instance.default_pos_printer = printer_settings.get(
                'default_pos_printer', instance.default_pos_printer)

        instance.save()
        return instance


class UserProfileSerializer(serializers.ModelSerializer):
    """Enhanced user serializer that includes employee information for profile page"""
    printer_settings = serializers.SerializerMethodField()
    employee = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'role', 'theme', 'sidebar_behavior',
                  'grid_rows_per_page', 'printer_settings', 'employee']

    def get_printer_settings(self, obj):
        return {
            'default_a4_printer': obj.default_a4_printer,
            'default_a5_printer': obj.default_a5_printer,
            'default_pos_printer': obj.default_pos_printer,
        }

    def get_employee(self, obj):
        try:
            employee = obj.employee
            user_id = obj.id
            picture_filename = f'user_{user_id}.jpg'
            frontend_public_dir = os.path.join(
                settings.BASE_DIR.parent, 'frontend', 'public', 'images', 'profile-pictures'
            )
            picture_path = os.path.join(frontend_public_dir, picture_filename)
            if os.path.exists(picture_path):
                picture_version = int(os.path.getmtime(picture_path))
                picture_url = f'/images/profile-pictures/{picture_filename}?v={picture_version}'
            else:
                picture_url = None
            
            return {
                'id': employee.id,
                'full_name': employee.full_name,
                'profile_picture': picture_url,
                'address': employee.address,
                'phone': employee.phone,
                'emergency_contact': employee.emergency_contact,
                'nic': employee.nic,
                'department': employee.department,
                'designation': employee.designation,
                'date_of_joining': employee.date_of_joining,
                'date_of_birth': employee.date_of_birth,
            }
        except Employee.DoesNotExist:
            return None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile including employee data"""
    printer_settings = serializers.DictField(write_only=True, required=False)
    employee = serializers.DictField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'theme', 'sidebar_behavior', 'grid_rows_per_page',
                  'printer_settings', 'employee']

    def update(self, instance, validated_data):
        printer_settings = validated_data.pop('printer_settings', None)
        employee_data = validated_data.pop('employee', None)

        # Update regular user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Update printer settings if provided
        if printer_settings:
            instance.default_a4_printer = printer_settings.get(
                'default_a4_printer', instance.default_a4_printer)
            instance.default_a5_printer = printer_settings.get(
                'default_a5_printer', instance.default_a5_printer)
            instance.default_pos_printer = printer_settings.get(
                'default_pos_printer', instance.default_pos_printer)

        # Update employee data if provided
        if employee_data:
            try:
                employee = instance.employee
                for attr, value in employee_data.items():
                    if hasattr(employee, attr):
                        setattr(employee, attr, value)
                employee.save()
            except Employee.DoesNotExist:
                # Create employee if it doesn't exist
                Employee.objects.create(user=instance, **employee_data)

        instance.save()
        return instance
