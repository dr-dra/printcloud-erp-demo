#!/usr/bin/env python
"""
AWS Configuration Diagnostic Script
Checks AWS credentials, permissions, and Bedrock model access
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

from django.conf import settings
import boto3
from botocore.exceptions import ClientError, NoCredentialsError


def check_credentials():
    """Check if AWS credentials are configured"""
    print("\n" + "="*60)
    print("1. CHECKING AWS CREDENTIALS")
    print("="*60)

    ai_access_key = settings.AWS_AI_ACCESS_KEY_ID
    ai_secret_key = settings.AWS_AI_SECRET_ACCESS_KEY
    ai_region = settings.AWS_AI_REGION

    if not ai_access_key or not ai_secret_key:
        print("❌ AWS AI credentials not configured in .env")
        print("   Required: AWS_AI_ACCESS_KEY_ID, AWS_AI_SECRET_ACCESS_KEY")
        return False

    print(f"✅ AWS_AI_ACCESS_KEY_ID: {ai_access_key[:8]}...")
    print(f"✅ AWS_AI_SECRET_ACCESS_KEY: {'*' * 20}")
    print(f"✅ AWS_AI_REGION: {ai_region}")

    # Test credentials validity
    try:
        sts = boto3.client(
            'sts',
            aws_access_key_id=ai_access_key,
            aws_secret_access_key=ai_secret_key,
            region_name=ai_region
        )
        identity = sts.get_caller_identity()
        print(f"✅ Credentials valid for IAM user: {identity['Arn']}")
        return True
    except Exception as e:
        print(f"❌ Credentials invalid: {str(e)}")
        return False


def check_iam_permissions():
    """Check IAM permissions for Textract, Bedrock, and Marketplace"""
    print("\n" + "="*60)
    print("2. CHECKING IAM PERMISSIONS")
    print("="*60)

    iam = boto3.client(
        'iam',
        aws_access_key_id=settings.AWS_AI_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_AI_SECRET_ACCESS_KEY,
        region_name=settings.AWS_AI_REGION
    )

    sts = boto3.client(
        'sts',
        aws_access_key_id=settings.AWS_AI_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_AI_SECRET_ACCESS_KEY,
        region_name=settings.AWS_AI_REGION
    )

    try:
        # Get current user
        identity = sts.get_caller_identity()
        user_arn = identity['Arn']
        username = user_arn.split('/')[-1]

        print(f"IAM User: {username}")
        print("\nChecking attached policies...")

        # List user policies
        try:
            inline_policies = iam.list_user_policies(UserName=username)
            attached_policies = iam.list_attached_user_policies(UserName=username)

            print(f"  Inline policies: {len(inline_policies.get('PolicyNames', []))}")
            print(f"  Attached policies: {len(attached_policies.get('AttachedPolicies', []))}")

            # Check for required permissions
            required_actions = [
                'textract:DetectDocumentText',
                'bedrock:InvokeModel',
                'aws-marketplace:ViewSubscriptions',
                'aws-marketplace:Subscribe'
            ]

            print("\nRequired permissions:")
            for action in required_actions:
                print(f"  • {action}")

            print("\n⚠️  Cannot automatically verify individual permissions.")
            print("    Please check your IAM policies manually.")

        except ClientError as e:
            if 'AccessDenied' in str(e):
                print("⚠️  Cannot list IAM policies (limited permissions)")
            else:
                raise

        return True

    except Exception as e:
        print(f"❌ Error checking IAM permissions: {str(e)}")
        return False


def check_textract():
    """Check Textract access"""
    print("\n" + "="*60)
    print("3. CHECKING TEXTRACT ACCESS")
    print("="*60)

    if not settings.AWS_TEXTRACT_ENABLED:
        print("⚠️  Textract is disabled in settings")
        return False

    try:
        textract = boto3.client(
            'textract',
            aws_access_key_id=settings.AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_AI_SECRET_ACCESS_KEY,
            region_name=settings.AWS_AI_REGION
        )

        # Create a simple test image (1x1 white pixel PNG)
        test_image = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        response = textract.detect_document_text(
            Document={'Bytes': test_image}
        )

        print("✅ Textract is accessible and working")
        print(f"   Blocks detected: {len(response.get('Blocks', []))}")
        return True

    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'AccessDeniedException':
            print("❌ Textract access denied")
            print("   Add 'textract:DetectDocumentText' to IAM policy")
        else:
            print(f"❌ Textract error: {error_code}")
        return False
    except Exception as e:
        print(f"❌ Textract error: {str(e)}")
        return False


def check_bedrock():
    """Check Bedrock and Claude model access"""
    print("\n" + "="*60)
    print("4. CHECKING BEDROCK & CLAUDE ACCESS")
    print("="*60)

    if not settings.AWS_BEDROCK_ENABLED:
        print("⚠️  Bedrock is disabled in settings")
        return False

    print(f"Model ID: {settings.AWS_BEDROCK_MODEL_ID}")
    print(f"Region: {settings.AWS_BEDROCK_REGION}")

    try:
        bedrock = boto3.client(
            'bedrock-runtime',
            aws_access_key_id=settings.AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_AI_SECRET_ACCESS_KEY,
            region_name=settings.AWS_BEDROCK_REGION
        )

        # Try to invoke Claude with minimal request
        test_request = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 10,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": "Hi"
                }
            ]
        }

        response = bedrock.invoke_model(
            modelId=settings.AWS_BEDROCK_MODEL_ID,
            body=json.dumps(test_request)
        )

        print("✅ Bedrock is accessible")
        print("✅ Claude model access granted")
        return True

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        if error_code == 'AccessDeniedException':
            print("❌ Bedrock access denied")
            print(f"   Error: {error_message}")

            if 'Marketplace' in error_message or 'marketplace' in error_message:
                print("\n🔧 FIX REQUIRED: AWS Marketplace Permissions")
                print("   Your IAM user needs AWS Marketplace permissions.")
                print("   See fix instructions below.")
            elif 'model access' in error_message.lower():
                print("\n🔧 FIX REQUIRED: Request Bedrock Model Access")
                print("   1. Go to: https://console.aws.amazon.com/bedrock/")
                print("   2. Select region: us-east-1 (top right)")
                print("   3. Click 'Model access' in left sidebar")
                print("   4. Click 'Request model access' button")
                print("   5. Find 'Anthropic' section")
                print("   6. Check ✅ 'Claude 3.5 Sonnet v2'")
                print("   7. Click 'Request model access'")
                print("   8. Wait 30-60 seconds")
                print("   9. Refresh page - status should be 'Access granted' ✅")
            else:
                print(f"   Add 'bedrock:InvokeModel' to IAM policy")
        else:
            print(f"❌ Bedrock error: {error_code}")
            print(f"   Message: {error_message}")

        return False

    except Exception as e:
        print(f"❌ Bedrock error: {str(e)}")
        return False


def print_fix_instructions():
    """Print instructions to fix common issues"""
    print("\n" + "="*60)
    print("FIX INSTRUCTIONS")
    print("="*60)

    print("\n📋 OPTION 1: Update IAM Policy via AWS Console")
    print("-" * 60)
    print("1. Go to: https://console.aws.amazon.com/iam/home#/users")
    print("2. Click on your IAM user")
    print("3. Go to 'Permissions' tab")
    print("4. Find 'PrintCloudAIScanning' policy (or create new)")
    print("5. Click 'Edit policy' → 'JSON'")
    print("6. Use the updated policy from:")
    print("   docs/supplier_bills/iam_policy.json")
    print("7. Click 'Review policy' → 'Save changes'")

    print("\n📋 OPTION 2: Update IAM Policy via AWS CLI")
    print("-" * 60)
    print("Run this command:")
    print()
    print("aws iam put-user-policy \\")
    print("  --user-name YOUR_USERNAME \\")
    print("  --policy-name PrintCloudAIScanning \\")
    print("  --policy-document file://docs/supplier_bills/iam_policy.json")
    print()
    print("Replace YOUR_USERNAME with your IAM username")

    print("\n📋 Request Bedrock Model Access")
    print("-" * 60)
    print("1. Go to: https://console.aws.amazon.com/bedrock/")
    print("2. Select region: us-east-1 (top right)")
    print("3. Click 'Model access' in left sidebar")
    print("4. Click 'Request model access' button")
    print("5. Find 'Anthropic' section")
    print("6. Check ✅ 'Claude 3.5 Sonnet v2'")
    print("7. Click 'Request model access'")
    print("8. Wait 30-60 seconds, then refresh")

    print("\n📋 After Making Changes")
    print("-" * 60)
    print("Run this script again to verify:")
    print("  python backend/scripts/diagnose_aws.py")


def main():
    """Run all diagnostic checks"""
    print("\n" + "="*60)
    print("AWS CONFIGURATION DIAGNOSTIC")
    print("="*60)

    results = []

    # Run checks
    results.append(("Credentials", check_credentials()))
    results.append(("IAM Permissions", check_iam_permissions()))
    results.append(("Textract", check_textract()))
    results.append(("Bedrock/Claude", check_bedrock()))

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")

    all_passed = all(result[1] for result in results)

    if all_passed:
        print("\n🎉 All checks passed! AWS is configured correctly.")
        print("\nYou can now test bill scanning:")
        print("  python backend/scripts/test_aws.sh")
    else:
        print("\n⚠️  Some checks failed. See fix instructions below.")
        print_fix_instructions()

    print("\n" + "="*60)

    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
