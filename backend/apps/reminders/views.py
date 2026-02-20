from rest_framework import status, viewsets, decorators
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Prefetch
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from .models import Reminder, Notification, ReminderActivity
from .serializers import (
    ReminderCreateSerializer,
    ReminderUpdateSerializer,
    ReminderListSerializer,
    ReminderDetailSerializer,
    NotificationSerializer,
    UserBasicSerializer
)

User = get_user_model()


class ReminderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing reminders
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'entity_type', 'assignee_user']

    def get_serializer_class(self):
        if self.action == 'create':
            return ReminderCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ReminderUpdateSerializer
        elif self.action == 'retrieve':
            return ReminderDetailSerializer
        return ReminderListSerializer

    def get_queryset(self):
        """Return reminders visible to the current user"""
        user = self.request.user

        # Users can see reminders assigned to them or created by them
        queryset = Reminder.objects.filter(
            Q(assignee_user=user) | Q(created_by=user)
        ).select_related(
            'assignee_user', 'created_by'
        ).prefetch_related(
            'activities__actor_user',
            'notifications'
        ).order_by('-created_at')

        return queryset

    @decorators.action(detail=True, methods=['post'])
    def snooze(self, request, pk=None):
        """Snooze a reminder by 1 day (default) or specified days"""
        reminder = self.get_object()
        days = int(request.data.get('days', 1))

        reminder.snooze(days=days)

        # Log activity
        ReminderActivity.objects.create(
            reminder=reminder,
            actor_user=request.user,
            action='snooze',
            meta={'days': days}
        )

        serializer = self.get_serializer(reminder)
        return Response(serializer.data)

    @decorators.action(detail=True, methods=['post'])
    def mark_done(self, request, pk=None):
        """Mark a reminder as done"""
        reminder = self.get_object()
        reminder.mark_done()

        # Log activity
        ReminderActivity.objects.create(
            reminder=reminder,
            actor_user=request.user,
            action='done'
        )

        serializer = self.get_serializer(reminder)
        return Response(serializer.data)

    @decorators.action(detail=False, methods=['get'])
    def notifications(self, request):
        """Get user's notifications with unread count (excluding archived)"""
        user = request.user

        # Get all recent non-archived notifications (both read and unread)
        notifications = Notification.objects.filter(
            user=user,
            is_archived=False  # Exclude archived notifications
        ).select_related(
            'reminder__assignee_user',
            'reminder__created_by'
        ).order_by('-created_at')[:20]  # Limit to recent 20

        # Get unread count separately (excluding archived)
        unread_count = Notification.objects.filter(
            user=user,
            read_at__isnull=True,
            is_archived=False
        ).count()

        serializer = NotificationSerializer(notifications, many=True)

        return Response({
            'unread_count': unread_count,
            'notifications': serializer.data
        })

    @decorators.action(detail=False, methods=['post'])
    def mark_notification_read(self, request):
        """Mark a specific notification as read"""
        notification_id = request.data.get('notification_id')

        if not notification_id:
            return Response(
                {'error': 'notification_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            notification = Notification.objects.get(
                id=notification_id,
                user=request.user,
                is_archived=False  # Only allow marking non-archived notifications as read
            )
            notification.mark_as_read()

            return Response({'success': True})

        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @decorators.action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all non-archived notifications as read for the current user"""
        updated_count = Notification.objects.filter(
            user=request.user,
            read_at__isnull=True,
            is_archived=False  # Only mark non-archived notifications as read
        ).update(read_at=timezone.now())

        return Response({
            'success': True,
            'marked_read_count': updated_count
        })

    @decorators.action(detail=False, methods=['post'])
    def archive_notification(self, request):
        """Archive a specific notification for the current user"""
        notification_id = request.data.get('notification_id')

        if not notification_id:
            return Response(
                {'error': 'notification_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            notification = Notification.objects.get(
                id=notification_id,
                user=request.user,
                is_archived=False  # Only allow archiving non-archived notifications
            )
            notification.archive()

            return Response({'success': True})

        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @decorators.action(detail=False, methods=['post'])
    def clear_done_notifications(self, request):
        """Archive all done/attended notifications for the current user"""
        # Find notifications that are read and their reminders are overdue or done
        notifications_to_archive = Notification.objects.filter(
            user=request.user,
            read_at__isnull=False,  # Only read notifications
            is_archived=False  # Only non-archived notifications
        ).filter(
            Q(reminder__status__in=['done', 'canceled']) |  # Reminder is done/canceled
            Q(reminder__due_at__lt=timezone.now())  # Or reminder is overdue
        )
        
        archived_count = notifications_to_archive.update(is_archived=True)

        return Response({
            'success': True,
            'archived_count': archived_count
        })

    @decorators.action(detail=False, methods=['get'])
    def assignable_users(self, request):
        """Get list of users that can be assigned reminders"""
        # For now, return all active users
        # In future, this could be filtered by company/team/permissions
        users = User.objects.filter(
            is_active=True).order_by('username', 'email')
        serializer = UserBasicSerializer(users, many=True)
        return Response(serializer.data)

    @decorators.action(detail=False, methods=['get'])
    def current_user(self, request):
        """Get current user info for default assignee"""
        serializer = UserBasicSerializer(request.user)
        return Response(serializer.data)

    @decorators.action(detail=False, methods=['get'])
    def summary(self, request):
        """Get reminder summary for dashboard"""
        user = request.user

        # Get user's reminders
        user_reminders = Reminder.objects.filter(assignee_user=user)

        # Count by status
        overdue_count = user_reminders.filter(
            due_at__lt=timezone.now(),
            status__in=['pending', 'sent']
        ).count()

        due_today_count = user_reminders.filter(
            due_at__date=timezone.now().date(),
            status__in=['pending', 'sent']
        ).count()

        upcoming_count = user_reminders.filter(
            due_at__gt=timezone.now(),
            due_at__lte=timezone.now() + timezone.timedelta(days=7),
            status__in=['pending', 'sent']
        ).count()

        return Response({
            'overdue': overdue_count,
            'due_today': due_today_count,
            'upcoming_7_days': upcoming_count,
            'total_active': overdue_count + due_today_count + upcoming_count
        })
