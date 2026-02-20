#!/usr/bin/env python
import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from apps.purchases.models import BillScan

scan = BillScan.objects.get(id=2)
print(f"Status: {scan.processing_status}")
print(f"Completed at: {scan.processing_completed_at}")
print(f"Has extracted data: {bool(scan.extracted_data)}")
print(f"Matched supplier: {scan.matched_supplier_id}")

if scan.extracted_data:
    print("\nExtracted data:")
    for field, data in scan.extracted_data.items():
        print(f"  {field}: {data.get('value')} ({data.get('confidence')*100:.0f}%)")
