#!/usr/bin/env python
"""Quick test to see what the bill API is returning"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.purchases.models import SupplierBill
from apps.purchases.serializers import SupplierBillListSerializer

# Get bill 5
bills = SupplierBill.objects.select_related('supplier', 'purchase_order', 'created_by', 'approved_by', 'scan_source').filter(id=5)
serializer = SupplierBillListSerializer(bills, many=True)

import json
print(json.dumps(serializer.data, indent=2))
