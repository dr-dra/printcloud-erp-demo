#!/usr/bin/env python
"""
Verification script to ensure Django and Celery are properly configured
and can run from the same virtual environment.
"""

import os
import sys
import django
from pathlib import Path

def main():
    print("🔍 PrintCloud Environment Verification")
    print("=" * 50)
    
    # Set Django settings
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    
    try:
        # Test Django setup
        print("\n1. Testing Django setup...")
        django.setup()
        print("   ✅ Django configured successfully")
        
        # Test Celery import
        print("\n2. Testing Celery import...")
        from config.celery_app import app as celery_app
        print(f"   ✅ Celery app imported: {celery_app.main}")
        print(f"   ✅ Broker URL: {celery_app.conf.broker_url}")
        
        # Test database connection
        print("\n3. Testing database connection...")
        from django.db import connection
        from apps.users.models import User
        user_count = User.objects.count()
        print(f"   ✅ Database connected (PostgreSQL)")
        print(f"   ✅ Found {user_count} users in database")
        
        # Test Redis connection
        print("\n4. Testing Redis connection...")
        import redis
        r = redis.Redis(host='127.0.0.1', port=6379, db=0)
        r.ping()
        print("   ✅ Redis connection successful")
        
        # Test reminder models
        print("\n5. Testing reminder models...")
        from apps.reminders.models import Reminder, Notification
        reminder_count = Reminder.objects.count()
        notification_count = Notification.objects.count()
        print(f"   ✅ Reminders table accessible ({reminder_count} reminders)")
        print(f"   ✅ Notifications table accessible ({notification_count} notifications)")
        
        print("\n" + "=" * 50)
        print("🎉 All tests passed! Your environment is properly configured.")
        print("\nTo start the services:")
        print("1. Django: source venv/bin/activate && python manage.py runserver")
        print("2. Celery Worker: source venv/bin/activate && celery -A config worker --loglevel=info")
        print("3. Celery Beat: source venv/bin/activate && celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler")
        
    except ImportError as e:
        print(f"   ❌ Import error: {e}")
        return 1
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())