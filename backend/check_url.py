import os
import django
from django.urls import resolve, reverse
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def check_url():
    url_path = '/api/pos/orders/monthly_sales_report/'
    print(f"Checking URL: {url_path}")
    try:
        resolved = resolve(url_path)
        print(f"Match found! View: {resolved.func.__name__}, URL Name: {resolved.url_name}")
    except Exception as e:
        print(f"Error resolving URL: {e}")
        
    # Try with hyphens just in case
    url_path_hyphen = '/api/pos/orders/monthly-sales-report/'
    print(f"Checking URL: {url_path_hyphen}")
    try:
        resolved = resolve(url_path_hyphen)
        print(f"Match found! View: {resolved.func.__name__}, URL Name: {resolved.url_name}")
    except Exception as e:
        print(f"Error resolving URL: {e}")

if __name__ == '__main__':
    check_url()
