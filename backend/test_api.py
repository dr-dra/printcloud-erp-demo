#!/usr/bin/env python
"""
Simple API test script to verify the quotations endpoints work
"""
import requests
import json
import sys

def test_quotations_api():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Quotations API...")
    
    # Test the quotations list endpoint
    try:
        response = requests.get(f"{base_url}/api/sales/quotations/", timeout=5)
        print(f"📡 GET /api/sales/quotations/ - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Response successful!")
            print(f"   📊 Count: {data.get('count', 'N/A')}")
            print(f"   📝 Results: {len(data.get('results', []))}")
            
            # Print first quotation if exists
            if data.get('results'):
                quotation = data['results'][0]
                print(f"   🧾 First quotation: {quotation.get('quot_number')} - Total: {quotation.get('total')}")
                
                # Test detail endpoint
                quotation_id = quotation.get('id')
                detail_response = requests.get(f"{base_url}/api/sales/quotations/{quotation_id}/", timeout=5)
                print(f"📡 GET /api/sales/quotations/{quotation_id}/ - Status: {detail_response.status_code}")
                
                if detail_response.status_code == 200:
                    detail_data = detail_response.json()
                    print(f"✅ Detail API successful!")
                    print(f"   🧾 Quotation: {detail_data.get('quot_number')}")
                    print(f"   📋 Items: {len(detail_data.get('items', []))}")
        else:
            print(f"❌ API Error: {response.status_code} - {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Django server might not be running")
        print("💡 Start server with: python manage.py runserver")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
        
    return True

if __name__ == "__main__":
    success = test_quotations_api()
    sys.exit(0 if success else 1)