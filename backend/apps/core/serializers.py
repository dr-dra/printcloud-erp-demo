from rest_framework import serializers
from .models import DocumentCommunicationLog, BugReport


class DocumentCommunicationLogSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentCommunicationLog with user details
    """
    sent_by_details = serializers.SerializerMethodField()

    class Meta:
        model = DocumentCommunicationLog
        fields = [
            'id',
            'doc_type',
            'doc_id',
            'method',
            'destination',
            'success',
            'message',
            'error_message',
            'sent_at',
            'sent_by',
            'sent_by_details',
        ]
        read_only_fields = ['id', 'sent_at', 'sent_by', 'sent_by_details']

    def get_sent_by_details(self, obj):
        """Return user details"""
        if obj.sent_by:
            # Try to get full name from employee profile, otherwise use username or email
            full_name = obj.sent_by.username
            try:
                if hasattr(obj.sent_by, 'employee') and obj.sent_by.employee:
                    full_name = obj.sent_by.employee.full_name
            except Exception:
                pass

            # Fallback to email if no username
            if not full_name:
                full_name = obj.sent_by.email

            return {
                'id': obj.sent_by.id,
                'username': obj.sent_by.username or obj.sent_by.email,
                'full_name': full_name,
            }
        return {
            'id': None,
            'username': 'System',
            'full_name': 'System',
        }


class BugReportSerializer(serializers.ModelSerializer):
    created_by_details = serializers.SerializerMethodField()

    class Meta:
        model = BugReport
        fields = [
            'id',
            'page_url',
            'description',
            'screenshot',
            'user_agent',
            'created_at',
            'created_by',
            'created_by_details',
        ]
        read_only_fields = ['id', 'created_at', 'created_by', 'created_by_details']

    def validate_screenshot(self, value):
        max_size = 5 * 1024 * 1024  # 5MB
        if value and value.size > max_size:
            raise serializers.ValidationError('Screenshot must be 5MB or smaller.')
        return value

    def get_created_by_details(self, obj):
        if obj.created_by:
            full_name = obj.created_by.username
            try:
                if hasattr(obj.created_by, 'employee') and obj.created_by.employee:
                    full_name = obj.created_by.employee.full_name
            except Exception:
                pass

            if not full_name:
                full_name = obj.created_by.email

            return {
                'id': obj.created_by.id,
                'username': obj.created_by.username or obj.created_by.email,
                'full_name': full_name,
                'role': getattr(obj.created_by, 'role', None),
                'email': obj.created_by.email,
            }
        return {
            'id': None,
            'username': 'System',
            'full_name': 'System',
            'role': None,
            'email': None,
        }
