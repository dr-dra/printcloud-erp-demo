#!/usr/bin/env python
"""
Test bill extraction with sample bill image
"""

import os
import sys
import json
from pathlib import Path

# Add Django project to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from apps.purchases.services.ai_extraction import AIExtractionService


def main():
    # Load sample bill
    bill_path = "/home/dharshana/projects/printcloud/docs/uGB2dMdBqjlS.jpg"

    if not os.path.exists(bill_path):
        print(f"❌ Bill image not found at: {bill_path}")
        return 1

    print("\n" + "="*60)
    print("TESTING AI BILL EXTRACTION")
    print("="*60)
    print(f"Bill image: {bill_path}")

    with open(bill_path, "rb") as f:
        file_bytes = f.read()

    print(f"File size: {len(file_bytes):,} bytes")
    print("\nProcessing with Textract + Claude...")
    print("(This may take 10-20 seconds)")

    # Process the bill
    svc = AIExtractionService()

    try:
        result = svc.process_bill_scan(file_bytes=file_bytes, file_type="image/jpeg")

        print("\n✅ Processing successful!")

        print("\n" + "="*60)
        print("EXTRACTED DATA")
        print("="*60)

        extracted = result['extracted_data']
        for field, data in extracted.items():
            value = data.get('value', 'N/A')
            confidence = data.get('confidence', 0) * 100

            # Color code confidence
            if confidence >= 85:
                status = "✅"
            elif confidence >= 70:
                status = "⚠️ "
            else:
                status = "❌"

            print(f"{status} {field:20} = {str(value):30} ({confidence:.0f}%)")

        print("\n" + "="*60)
        print("SUPPLIER MATCHING")
        print("="*60)

        if result['matched_supplier_id']:
            print(f"✅ Matched Supplier ID: {result['matched_supplier_id']}")
            print(f"   Match Confidence: {result['supplier_match_confidence']:.1%}")
        else:
            print("❌ No supplier match found")
            supplier_name = extracted.get('supplier_name', {}).get('value')
            if supplier_name:
                print(f"   Extracted name: {supplier_name}")
                print("   (You may need to create this supplier or match manually)")

        print("\n" + "="*60)
        print("RAW RESPONSE SIZES")
        print("="*60)
        print(f"Textract response: {len(str(result['textract_response'])):,} chars")
        print(f"Claude response: {len(str(result['claude_response'])):,} chars")

        return 0

    except Exception as e:
        print(f"\n❌ Processing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
