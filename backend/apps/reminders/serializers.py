from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Reminder, Notification, ReminderActivity

User = get_user_model()


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for reminders"""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'full_name']

    def get_full_name(self, obj):
        """Return display name for user"""
        if obj.username:
            return obj.username
        return obj.email


class ReminderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating reminders"""

    class Meta:
        model = Reminder
        fields = [
            'entity_type', 'entity_id', 'entity_ref',
            'assignee_user', 'due_at', 'note', 'origin_module',
            'auto_cancel_on_states', 'link_path', 'company_id'
        ]

    def create(self, validated_data):
        # Set created_by to the current user
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ReminderUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating reminders"""

    class Meta:
        model = Reminder
        fields = ['due_at', 'note', 'status', 'auto_cancel_on_states']

    def update(self, instance, validated_data):
        # Log activity when status changes
        old_status = instance.status
        new_status = validated_data.get('status', old_status)

        reminder = super().update(instance, validated_data)

        # Create activity log for status changes
        if old_status != new_status:
            ReminderActivity.objects.create(
                reminder=reminder,
                actor_user=self.context['request'].user,
                action=new_status,
                meta={
                    'old_status': old_status,
                    'new_status': new_status
                }
            )

        return reminder


class ReminderListSerializer(serializers.ModelSerializer):
    """Serializer for listing reminders"""
    assignee_user = UserBasicSerializer(read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_due_today = serializers.BooleanField(read_only=True)

    class Meta:
        model = Reminder
        fields = [
            'id', 'entity_type', 'entity_id', 'entity_ref',
            'assignee_user', 'due_at', 'note', 'status',
            'origin_module', 'auto_cancel_on_states',
            'created_by', 'created_at', 'updated_at',
            'link_path', 'is_overdue', 'is_due_today'
        ]


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications"""
    reminder = ReminderListSerializer(read_only=True)
    is_unread = serializers.BooleanField(read_only=True)
    time_since_created = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'reminder', 'channel', 'delivered_at',
            'read_at', 'created_at', 'is_unread', 'time_since_created'
        ]

    def get_time_since_created(self, obj):
        """Get human-readable time since notification was created"""
        now = timezone.now()
        diff = now - obj.created_at

        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"


class ReminderActivitySerializer(serializers.ModelSerializer):
    """Serializer for reminder activity logs"""
    actor_user = UserBasicSerializer(read_only=True)

    class Meta:
        model = ReminderActivity
        fields = ['id', 'action', 'actor_user', 'meta', 'created_at']


class ReminderDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for individual reminders"""
    assignee_user = UserBasicSerializer(read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    activities = ReminderActivitySerializer(many=True, read_only=True)
    notifications = NotificationSerializer(many=True, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_due_today = serializers.BooleanField(read_only=True)

    class Meta:
        model = Reminder
        fields = [
            'id', 'entity_type', 'entity_id', 'entity_ref',
            'assignee_user', 'due_at', 'note', 'status',
            'origin_module', 'auto_cancel_on_states',
            'created_by', 'created_at', 'updated_at',
            'link_path', 'is_overdue', 'is_due_today',
            'activities', 'notifications'
        ]
