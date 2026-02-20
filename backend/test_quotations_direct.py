#!/usr/bin/env python
"""Direct test of quotations API using Django test client"""

from django.core.wsgi import get_wsgi_application
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
get_wsgi_application()

from django.test import Client
from rest_framework.test import APIClient
from apps.users.models import User
from django.contrib.auth import authenticate
import json

def test_quotations_api():
    """Test the quotations API endpoint directly"""
    print("🧪 Testing quotations API with Django test client...")
    
    # Create API client
    client = APIClient()
    
    # Get or create a test user
    try:
        user = User.objects.get(email='test@example.com')
    except User.DoesNotExist:
        user = User.objects.create_user(email='test@example.com', password='testpass123')
    
    # Authenticate the client
    client.force_authenticate(user=user)
    
    try:
        # Test the quotations endpoint
        print("📊 Making API request to /api/sales/quotations/...")
        response = client.get('/api/sales/quotations/', {'page_size': 5})
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Test Success! Status: {response.status_code}")
            print(f"📋 Found {data['count']} quotations")
            
            if data['results']:
                print("\nSample quotation data:")
                q = data['results'][0]
                print(f"- Quotation Number: {q['quot_number']}")
                print(f"- Customer: {q.get('customer_name', 'No customer')}")
                print(f"- Total: ${q['total']}")
                print(f"- Finalized: {q['finalized']}")
                print(f"- Active: {q['is_active']}")
                print(f"- Date: {q.get('date', 'N/A')}")
                print(f"\n🔍 All fields: {', '.join(list(q.keys()))}")
                
            return True
        else:
            print(f"❌ API request failed: {response.status_code}")
            print(f"Response: {response.content.decode()}")
            
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
    
    return False

if __name__ == "__main__":
    test_quotations_api()