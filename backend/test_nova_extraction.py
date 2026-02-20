#!/usr/bin/env python
"""
Test script for Nova 2 Lite bill extraction

Usage:
    python test_nova_extraction.py

This script:
1. Lists available Bedrock models in your AWS account
2. Tests Nova extraction with a sample bill
3. Provides detailed debugging information
"""

import os
import sys
import django
import json
import boto3
from pathlib import Path

# Setup Django
sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from apps.purchases.services.ai_extraction import AIExtractionService


def list_available_models():
    """List all available Bedrock foundation models"""
    print("\n" + "="*80)
    print("STEP 1: Listing Available Bedrock Models")
    print("="*80)

    try:
        bedrock_client = boto3.client(
            'bedrock',
            aws_access_key_id=settings.AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_AI_SECRET_ACCESS_KEY,
            region_name=settings.AWS_BEDROCK_REGION,
        )

        response = bedrock_client.list_foundation_models()

        print(f"\n✅ Found {len(response['modelSummaries'])} models in {settings.AWS_BEDROCK_REGION}")
        print("\nAvailable Nova models:")

        nova_models = []
        for model in response['modelSummaries']:
            if 'nova' in model['modelId'].lower():
                nova_models.append(model)
                print(f"  • {model['modelId']}")
                print(f"    Name: {model.get('modelName', 'N/A')}")
                print(f"    Provider: {model.get('providerName', 'N/A')}")
                print(f"    Input Modalities: {', '.join(model.get('inputModalities', []))}")
                print()

        if not nova_models:
            print("\n⚠️  WARNING: No Nova models found in your region!")
            print("    Nova 2 may not be available in", settings.AWS_BEDROCK_REGION)
            print("\n    Available multimodal models:")
            for model in response['modelSummaries']:
                modalities = model.get('inputModalities', [])
                if 'IMAGE' in modalities and 'TEXT' in modalities:
                    print(f"    • {model['modelId']} ({model.get('providerName', 'N/A')})")

        print("\nClaude models (for comparison):")
        for model in response['modelSummaries']:
            if 'claude' in model['modelId'].lower() and 'IMAGE' in model.get('inputModalities', []):
                print(f"  • {model['modelId']}")

        return nova_models

    except Exception as e:
        print(f"\n❌ Error listing models: {str(e)}")
        print(f"    Region: {settings.AWS_BEDROCK_REGION}")
        print(f"    Error type: {type(e).__name__}")
        return []


def check_model_access(model_id):
    """Check if we have access to invoke a specific model"""
    print("\n" + "="*80)
    print(f"STEP 2: Checking Access to Model: {model_id}")
    print("="*80)

    try:
        bedrock_client = boto3.client(
            'bedrock-runtime',
            aws_access_key_id=settings.AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_AI_SECRET_ACCESS_KEY,
            region_name=settings.AWS_BEDROCK_REGION,
        )

        # Try a minimal test request (Claude format)
        test_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 10,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": "Hello"}]
                }
            ]
        }

        response = bedrock_client.invoke_model(
            modelId=model_id,
            body=json.dumps(test_body)
        )

        print(f"✅ Model {model_id} is accessible!")
        return True

    except Exception as e:
        print(f"❌ Cannot access model {model_id}")
        print(f"   Error: {str(e)}")
        if "ValidationException" in str(e):
            print("\n   This might be a request format issue.")
        elif "AccessDeniedException" in str(e):
            print("\n   You need to enable this model in AWS Bedrock console:")
            print(f"   https://console.aws.amazon.com/bedrock/home?region={settings.AWS_BEDROCK_REGION}#/modelaccess")
        return False


def test_extraction_with_sample():
    """Test extraction with the sample bill"""
    print("\n" + "="*80)
    print("STEP 3: Testing Extraction with Sample Bill")
    print("="*80)

    sample_path = Path(__file__).parent.parent / "docs" / "uGB2dMdBqjlS.jpg"

    if not sample_path.exists():
        print(f"❌ Sample bill not found at: {sample_path}")
        return

    print(f"✅ Sample bill found: {sample_path}")
    print(f"   File size: {sample_path.stat().st_size / 1024:.1f} KB")

    # Read file
    with open(sample_path, 'rb') as f:
        file_bytes = f.read()

    print(f"\n📤 Attempting extraction...")
    print(f"   Model: {settings.AWS_BEDROCK_MODEL_ID}")
    print(f"   Region: {settings.AWS_BEDROCK_REGION}")

    try:
        # Initialize service
        ai_service = AIExtractionService()

        # Extract data
        extracted_data, raw_response = ai_service.nova_extract_bill_data(
            file_bytes=file_bytes,
            file_type='image/jpeg'
        )

        print("\n✅ Extraction successful!")
        print("\n📊 Extracted Data:")
        print("-" * 80)

        for field, data in extracted_data.items():
            value = data.get('value')
            confidence = data.get('confidence', 0.0)

            # Color code confidence
            if confidence >= 0.85:
                status = "🟢"
            elif confidence >= 0.70:
                status = "🟡"
            else:
                status = "🔴"

            print(f"{status} {field:20s}: {value or 'NULL':30s} (confidence: {confidence:.2f})")

        print("\n📝 Raw Response Structure:")
        print(f"   Keys: {list(raw_response.keys())}")

        return extracted_data

    except Exception as e:
        print(f"\n❌ Extraction failed!")
        print(f"   Error: {str(e)}")
        print(f"\n   Error type: {type(e).__name__}")

        if "ValidationException" in str(e):
            print("\n💡 Troubleshooting:")
            print("   1. The model might require a different request format")
            print("   2. Check if the model ID is correct")
            print("   3. Try a different Nova model ID")

        return None


def suggest_alternatives():
    """Suggest alternative approaches"""
    print("\n" + "="*80)
    print("STEP 4: Recommendations")
    print("="*80)

    print("\n🔧 If Nova 2 Lite is not available, alternatives:")
    print("\n1. Use Claude 3 Haiku (cheapest Claude model)")
    print("   Model ID: anthropic.claude-3-haiku-20240307-v1:0")
    print("   Cost: ~$0.25 per 1M input tokens")
    print("   Still 92% cheaper than Claude 3.5 Sonnet")

    print("\n2. Use Claude 3.5 Sonnet v2 (current, most accurate)")
    print("   Model ID: anthropic.claude-3-5-sonnet-20241022-v2:0")
    print("   Cost: ~$3 per 1M input tokens")
    print("   Best accuracy, higher cost")

    print("\n3. Wait for Nova 2 availability")
    print("   Nova models might not be GA in all regions yet")
    print("   Check AWS announcements for availability")

    print("\n📋 To enable a model in AWS:")
    print(f"   1. Go to: https://console.aws.amazon.com/bedrock/home?region={settings.AWS_BEDROCK_REGION}#/modelaccess")
    print("   2. Click 'Manage model access'")
    print("   3. Select the models you want")
    print("   4. Click 'Save changes'")
    print("   5. Wait 5-10 minutes for access to be granted")


def main():
    print("\n" + "="*80)
    print("🧪 Nova 2 Lite Extraction Test")
    print("="*80)

    print("\n📋 Current Configuration:")
    print(f"   AWS Region: {settings.AWS_BEDROCK_REGION}")
    print(f"   Model ID: {settings.AWS_BEDROCK_MODEL_ID}")
    print(f"   Bedrock Enabled: {settings.AWS_BEDROCK_ENABLED}")

    # Step 1: List available models
    nova_models = list_available_models()

    # Step 2: Check model access
    can_access = check_model_access(settings.AWS_BEDROCK_MODEL_ID)

    # Step 3: Test extraction if model is accessible
    if can_access:
        extracted_data = test_extraction_with_sample()

        if extracted_data:
            print("\n🎉 SUCCESS! Nova 2 Lite extraction is working!")
        else:
            print("\n⚠️  Model is accessible but extraction failed.")
            print("    Check the error details above.")
    else:
        print("\n⚠️  Cannot access the configured model.")
        print("    Trying to test with alternative models...")

        # Try alternative models
        alternatives = [
            "anthropic.claude-3-haiku-20240307-v1:0",
            "anthropic.claude-3-5-sonnet-20241022-v2:0"
        ]

        for alt_model in alternatives:
            print(f"\n   Testing {alt_model}...")
            if check_model_access(alt_model):
                print(f"\n   ✅ {alt_model} is available!")
                print(f"      You can use this model instead of Nova.")
                break

    # Step 4: Suggest alternatives
    suggest_alternatives()

    print("\n" + "="*80)
    print("Test Complete")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
