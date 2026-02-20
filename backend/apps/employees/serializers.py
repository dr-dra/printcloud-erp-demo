from rest_framework import serializers
from .models import Employee

class EmployeeSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Employee
        fields = [
            'id',
            'user',
            'full_name',
            'profile_picture',
            'address',
            'phone',
            'emergency_contact',
            'nic',
            'department',
            'designation',
            'date_of_joining',
            'date_of_birth',
            'bank_account_no',
            'bank_name',
        ]
