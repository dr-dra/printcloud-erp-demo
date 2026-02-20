#!/usr/bin/env python
"""
Test script to verify the enhanced date handling in the import command
"""
import os
import sys
import django
from datetime import datetime, date
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.sales.quotations.management.commands.import_quotations import Command

def test_date_handling():
    """Test the safe_date function with various input types"""
    cmd = Command()
    
    print("🧪 Testing Date Handling Functions\n")
    
    # Test cases for date handling
    test_cases = [
        # (input, expected_type, description)
        (None, type(None), "None input"),
        (datetime(2023, 12, 25, 14, 30, 0), datetime, "datetime object"),
        (date(2023, 12, 25), datetime, "date object"),
        ("2023-12-25 14:30:00", datetime, "MySQL datetime string"),
        ("2023-12-25", datetime, "MySQL date string"),
        ("25/12/2023", datetime, "DD/MM/YYYY format"),
        ("12/25/2023", datetime, "MM/DD/YYYY format"),
        ("", type(None), "empty string"),
        ("null", type(None), "null string"),
        ("invalid-date", type(None), "invalid date string"),
        ("2023-13-45", type(None), "invalid date values"),
    ]
    
    print("📅 Testing safe_date() function:")
    for i, (input_val, expected_type, description) in enumerate(test_cases, 1):
        try:
            result = cmd.safe_date(input_val)
            result_type = type(result)
            status = "✅" if result_type == expected_type else "❌"
            print(f"   {i:2d}. {status} {description:<25} | Input: {str(input_val):<20} | Result: {result} ({result_type.__name__})")
        except Exception as e:
            print(f"   {i:2d}. ❌ {description:<25} | Input: {str(input_val):<20} | Error: {e}")
    
    print("\n💰 Testing safe_decimal() function:")
    decimal_test_cases = [
        (None, "0", "None input"),
        (100.50, "100.50", "float input"),
        ("150.75", "150.75", "string number"),
        ("", "0", "empty string"),
        ("invalid", "0", "invalid string"),
        (Decimal("200.25"), "200.25", "Decimal input"),
    ]
    
    for i, (input_val, expected_str, description) in enumerate(decimal_test_cases, 1):
        try:
            result = cmd.safe_decimal(input_val)
            status = "✅" if str(result) == expected_str else "❌"
            print(f"   {i:2d}. {status} {description:<20} | Input: {str(input_val):<15} | Result: {result}")
        except Exception as e:
            print(f"   {i:2d}. ❌ {description:<20} | Input: {str(input_val):<15} | Error: {e}")
    
    print("\n📦 Testing safe_quantity() function:")
    quantity_test_cases = [
        (None, None, "None input"),
        ("1000", "1000", "string quantity"),
        ("", None, "empty string"),
        ("50.5", "50.5", "decimal quantity"),
        ("invalid", None, "invalid string"),
    ]
    
    for i, (input_val, expected, description) in enumerate(quantity_test_cases, 1):
        try:
            result = cmd.safe_quantity(input_val)
            expected_result = Decimal(expected) if expected is not None else None
            status = "✅" if result == expected_result else "❌"
            print(f"   {i:2d}. {status} {description:<20} | Input: {str(input_val):<15} | Result: {result}")
        except Exception as e:
            print(f"   {i:2d}. ❌ {description:<20} | Input: {str(input_val):<15} | Error: {e}")
    
    print("\n🎉 Date handling test complete!")

if __name__ == "__main__":
    test_date_handling()