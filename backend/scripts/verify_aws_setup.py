#!/usr/bin/env python
"""
AWS Configuration Verification Script for AI Bill Scanning

Tests:
1. AWS credentials are valid
2. S3 access works
3. Textract is accessible
4. Bedrock model access is granted
5. Complete AI extraction pipeline

Usage:
    python scripts/verify_aws_setup.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import boto3
import json
from django.conf import settings
from colorama import init, Fore, Style

# Initialize colorama for colored output
init(autoreset=True)


def print_header(text):
    """Print section header"""
    print(f"\n{Fore.CYAN}{'=' * 60}")
    print(f"{Fore.CYAN}{text}")
    print(f"{Fore.CYAN}{'=' * 60}\n")


def print_success(text):
    """Print success message"""
    print(f"{Fore.GREEN}✅ {text}")


def print_error(text):
    """Print error message"""
    print(f"{Fore.RED}❌ {text}")


def print_warning(text):
    """Print warning message"""
    print(f"{Fore.YELLOW}⚠️  {text}")


def print_info(text):
    """Print info message"""
    print(f"{Fore.BLUE}ℹ️  {text}")


def test_credentials():
    """Test 1: Verify AWS credentials are configured"""
    print_header("Test 1: AWS Credentials")

    try:
        if not settings.AWS_ACCESS_KEY_ID:
            print_error("AWS_ACCESS_KEY_ID not configured in .env")
            return False

        if not settings.AWS_SECRET_ACCESS_KEY:
            print_error("AWS_SECRET_ACCESS_KEY not configured in .env")
            return False

        print_success(f"AWS_ACCESS_KEY_ID: {settings.AWS_ACCESS_KEY_ID[:10]}...")
        print_success(f"AWS_STORAGE_BUCKET_NAME: {settings.AWS_STORAGE_BUCKET_NAME}")
        print_success(f"AWS_S3_REGION_NAME: {settings.AWS_S3_REGION_NAME}")

        # Test STS to validate credentials
        sts = boto3.client(
            'sts',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )

        identity = sts.get_caller_identity()
        print_success(f"IAM User ARN: {identity['Arn']}")
        print_success(f"AWS Account: {identity['Account']}")

        return True

    except Exception as e:
        print_error(f"Credentials test failed: {str(e)}")
        return False


def test_s3_access():
    """Test 2: Verify S3 access"""
    print_header("Test 2: S3 Access")

    try:
        s3 = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )

        # List buckets
        response = s3.list_buckets()
        bucket_names = [bucket['Name'] for bucket in response['Buckets']]

        if settings.AWS_STORAGE_BUCKET_NAME in bucket_names:
            print_success(f"Bucket '{settings.AWS_STORAGE_BUCKET_NAME}' exists")
        else:
            print_warning(f"Bucket '{settings.AWS_STORAGE_BUCKET_NAME}' not found")
            print_info(f"Available buckets: {', '.join(bucket_names)}")

        # Test write access
        test_key = 'test-ai-bill-scanning.txt'
        s3.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=test_key,
            Body=b'Test file for AI bill scanning verification'
        )
        print_success("Write access confirmed")

        # Clean up test file
        s3.delete_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=test_key
        )
        print_success("Delete access confirmed")

        return True

    except Exception as e:
        print_error(f"S3 test failed: {str(e)}")
        return False


def test_textract():
    """Test 3: Verify Textract access"""
    print_header("Test 3: AWS Textract")

    if not settings.AWS_TEXTRACT_ENABLED:
        print_warning("AWS_TEXTRACT_ENABLED is False in settings")
        return False

    try:
        textract = boto3.client(
            'textract',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )

        # Test with simple text
        test_document = b"""
        INVOICE
        Invoice Number: TEST-001
        Date: 2026-01-06
        Amount: $100.00
        """

        response = textract.detect_document_text(
            Document={'Bytes': test_document}
        )

        blocks = response.get('Blocks', [])
        text_blocks = [b for b in blocks if b['BlockType'] == 'LINE']

        print_success(f"Textract is accessible")
        print_success(f"Detected {len(text_blocks)} text lines")

        # Show extracted text
        print_info("Extracted text:")
        for block in text_blocks[:5]:  # Show first 5 lines
            print(f"   {block.get('Text', '')}")

        return True

    except Exception as e:
        print_error(f"Textract test failed: {str(e)}")
        print_info("Possible fixes:")
        print_info("1. Check IAM permissions include 'textract:DetectDocumentText'")
        print_info("2. Verify region supports Textract")
        return False


def test_bedrock():
    """Test 4: Verify Bedrock and Claude access"""
    print_header("Test 4: AWS Bedrock + Claude")

    if not settings.AWS_BEDROCK_ENABLED:
        print_warning("AWS_BEDROCK_ENABLED is False in settings")
        return False

    try:
        bedrock = boto3.client(
            'bedrock-runtime',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_BEDROCK_REGION
        )

        print_info(f"Testing model: {settings.AWS_BEDROCK_MODEL_ID}")
        print_info(f"Region: {settings.AWS_BEDROCK_REGION}")

        # Test Claude invocation
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 50,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": "Extract the invoice number from this text: Invoice #INV-2026-001. Respond with just the invoice number."
                }
            ]
        }

        response = bedrock.invoke_model(
            modelId=settings.AWS_BEDROCK_MODEL_ID,
            body=json.dumps(request_body)
        )

        response_body = json.loads(response['body'].read())
        assistant_message = response_body['content'][0]['text']

        print_success(f"Bedrock + Claude is accessible")
        print_success(f"Claude response: {assistant_message}")

        # Check usage
        usage = response_body.get('usage', {})
        print_info(f"Input tokens: {usage.get('input_tokens', 0)}")
        print_info(f"Output tokens: {usage.get('output_tokens', 0)}")

        return True

    except Exception as e:
        error_str = str(e)
        print_error(f"Bedrock test failed: {error_str}")

        if "Could not resolve the foundation model" in error_str:
            print_info("Model not available in this region")
            print_info(f"Current region: {settings.AWS_BEDROCK_REGION}")
            print_info("Try regions: us-east-1, us-west-2")

        elif "You don't have access to the model" in error_str:
            print_info("Model access not granted")
            print_info("Go to: AWS Console → Bedrock → Model access")
            print_info("Request access to: Anthropic Claude models")

        elif "security token" in error_str:
            print_info("Authentication error - check credentials")

        return False


def test_ai_pipeline():
    """Test 5: Complete AI extraction pipeline"""
    print_header("Test 5: Complete AI Extraction Pipeline")

    try:
        from apps.purchases.services.ai_extraction import AIExtractionService

        # Create test invoice
        test_invoice = b"""
        ABC Supplies Ltd.
        123 Main Street

        INVOICE

        Invoice Number: INV-2026-TEST
        Invoice Date: January 6, 2026
        Due Date: February 5, 2026

        ITEMS:
        Product A - $500.00
        Product B - $300.00

        Subtotal: $800.00
        Tax (15%): $120.00
        Total Amount Due: $920.00

        Thank you for your business!
        """

        print_info("Testing complete extraction pipeline...")
        print_info("This may take 10-15 seconds...")

        ai_service = AIExtractionService()
        result = ai_service.process_bill_scan(
            file_bytes=test_invoice,
            file_type='text/plain'
        )

        print_success("AI extraction pipeline completed successfully!")

        # Show extracted data
        extracted_data = result.get('extracted_data', {})

        print_info("\nExtracted Fields:")
        for field, data in extracted_data.items():
            value = data.get('value')
            confidence = data.get('confidence', 0)
            confidence_pct = int(confidence * 100)

            if confidence >= 0.85:
                color = Fore.GREEN
                level = "High"
            elif confidence >= 0.70:
                color = Fore.YELLOW
                level = "Medium"
            else:
                color = Fore.RED
                level = "Low"

            print(f"   {field}: {value} {color}({level} - {confidence_pct}%)")

        # Supplier matching
        if result.get('matched_supplier_id'):
            print_success(f"\n✅ Supplier auto-matched: ID {result['matched_supplier_id']}")
            print_info(f"Match confidence: {result.get('supplier_match_confidence', 0):.2f}")
        else:
            print_warning("\n⚠️  No supplier auto-matched (this is normal for test data)")

        return True

    except Exception as e:
        print_error(f"AI pipeline test failed: {str(e)}")
        import traceback
        print(Fore.RED + traceback.format_exc())
        return False


def main():
    """Run all tests"""
    print(f"\n{Fore.CYAN}{'*' * 60}")
    print(f"{Fore.CYAN}AWS Configuration Verification for AI Bill Scanning")
    print(f"{Fore.CYAN}{'*' * 60}\n")

    results = {
        "Credentials": test_credentials(),
        "S3 Access": test_s3_access(),
        "Textract": test_textract(),
        "Bedrock + Claude": test_bedrock(),
        "AI Pipeline": test_ai_pipeline(),
    }

    # Summary
    print_header("Summary")

    all_passed = True
    for test_name, passed in results.items():
        if passed:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print(f"{Fore.GREEN}{'🎉 All tests passed! AWS is configured correctly.'}")
        print(f"{Fore.GREEN}{'You can now use AI bill scanning in production.'}")
    else:
        print(f"{Fore.RED}{'❌ Some tests failed. Review the errors above.'}")
        print(f"{Fore.YELLOW}{'See docs/supplier_bills/aws_setup_guide.md for help.'}")

    print("=" * 60 + "\n")

    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
