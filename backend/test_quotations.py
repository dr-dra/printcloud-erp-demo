#!/usr/bin/env python
import requests
import json

def test_quotations_api():
    """Test the quotations API endpoint"""
    # Test with new test user
    auth_data = {'email': 'test@example.com', 'password': 'testpass123'}

    try:
        # Get authentication token
        print("🔐 Getting authentication token...")
        auth_response = requests.post('http://localhost:8000/api/auth/jwt/create/', json=auth_data, timeout=10)
        
        if auth_response.status_code == 200:
            token = auth_response.json()['access']
            headers = {'Authorization': f'Bearer {token}'}
            print("✅ Authentication successful!")
            
            # Test quotations endpoint
            print("📊 Testing quotations API...")
            response = requests.get('http://localhost:8000/api/sales/quotations/?page_size=5', headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Test Success! Found {data['count']} quotations")
                
                if data['results']:
                    print("\n📋 Sample quotation data:")
                    q = data['results'][0]
                    print(f"- Quotation Number: {q['quot_number']}")
                    print(f"- Customer: {q.get('customer_name', 'No customer')}")
                    print(f"- Total: ${q['total']}")
                    print(f"- Finalized: {q['finalized']}")
                    print(f"- Active: {q['is_active']}")
                    print(f"- Date: {q.get('date', 'N/A')}")
                    print(f"- Required Date: {q.get('required_date', 'N/A')}")
                    
                    print(f"\n🔍 Available fields: {', '.join(list(q.keys()))}")
                    
                    return True
                else:
                    print("⚠️ No quotations found in results")
                    
            else:
                print(f"❌ Quotations API failed: {response.status_code}")
                print(f"Response: {response.text}")
                
        else:
            print(f"❌ Authentication failed: {auth_response.status_code}")
            print(f"Response: {auth_response.text}")
            
    except Exception as e:
        print(f"❌ Test error: {e}")
        
    return False

if __name__ == "__main__":
    test_quotations_api()