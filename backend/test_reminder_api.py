#!/usr/bin/env python
"""
Test script to verify the reminders API is working correctly.
This addresses the frontend issue where the reminder modal was failing
to fetch available users for assignee selection.
"""

import os
import sys
import django
import requests
import json

# Configure Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()

def test_api():
    print("🧪 Testing Reminders API")
    print("=" * 50)
    
    # Ensure test user exists
    user, created = User.objects.get_or_create(
        email='api-test@printcloud.io',
        defaults={
            'username': 'API Test User',
            'is_active': True,
            'password': make_password('testpass123')
        }
    )
    
    if not created:
        user.password = make_password('testpass123')
        user.is_active = True
        user.save()
    
    print(f"✅ Test user ready: {user.email}")
    
    # Test login
    login_data = {
        'email': 'api-test@printcloud.io',
        'password': 'testpass123'
    }
    
    try:
        print("\n1. Testing JWT Login...")
        response = requests.post('http://127.0.0.1:8000/api/auth/jwt/create/', 
                                json=login_data, 
                                timeout=10)
        
        if response.status_code == 200:
            tokens = response.json()
            access_token = tokens['access']
            print(f"   ✅ Login successful, token: {access_token[:20]}...")
            
            # Test assignable users endpoint
            print("\n2. Testing Assignable Users Endpoint...")
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get('http://127.0.0.1:8000/api/reminders/assignable_users/',
                                  headers=headers,
                                  timeout=10)
            
            if response.status_code == 200:
                users = response.json()
                print(f"   ✅ API endpoint working! Found {len(users)} assignable users")
                print("   Sample users:")
                for user in users[:3]:
                    print(f"     - {user['full_name']} ({user['email']})")
                
                return True
            else:
                print(f"   ❌ API error: {response.status_code} - {response.text}")
                return False
        else:
            print(f"   ❌ Login failed: {response.status_code} - {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ Django server not running on http://127.0.0.1:8000")
        print("   Please start with: source venv/bin/activate && python manage.py runserver")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

if __name__ == '__main__':
    success = test_api()
    if success:
        print("\n" + "=" * 50)
        print("🎉 All tests passed!")
        print("\nThe frontend reminder modal should now work correctly.")
        print("The issue was caused by:")
        print("1. User model using 'username' instead of 'first_name'/'last_name'")
        print("2. Database query ordering by non-existent fields")
        print("3. UserBasicSerializer referencing wrong field names")
        print("\nSolution implemented:")
        print("1. Updated database query to use 'username' and 'email'")
        print("2. Fixed UserBasicSerializer to match actual User model")
        print("3. Updated frontend TypeScript types to match API response")
    else:
        print("\n❌ Tests failed. Check Django server and database connection.")
        sys.exit(1)