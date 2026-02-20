#!/usr/bin/env python3
"""
AWS Configuration Diagnostic Script (Simplified)
Checks AWS credentials, permissions, and Bedrock model access
Reads settings from .env file directly
"""

import os
import sys
import json
from pathlib import Path

# Try to load .env file
env_path = Path(__file__).resolve().parent.parent / '.env'

def load_env():
    """Load environment variables from .env file"""
    config = {}

    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    config[key.strip()] = value.strip().strip('"').strip("'")

    return config

# Load environment
env_config = load_env()

# Get AWS settings
AWS_AI_ACCESS_KEY_ID = env_config.get('AWS_AI_ACCESS_KEY_ID', '')
AWS_AI_SECRET_ACCESS_KEY = env_config.get('AWS_AI_SECRET_ACCESS_KEY', '')
AWS_AI_REGION = env_config.get('AWS_AI_REGION', 'us-east-1')
AWS_BEDROCK_REGION = env_config.get('AWS_BEDROCK_REGION', AWS_AI_REGION)
AWS_TEXTRACT_REGION = env_config.get('AWS_TEXTRACT_REGION', AWS_AI_REGION)
AWS_BEDROCK_MODEL_ID = env_config.get('AWS_BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0')
AWS_TEXTRACT_ENABLED = env_config.get('AWS_TEXTRACT_ENABLED', 'True').lower() == 'true'
AWS_BEDROCK_ENABLED = env_config.get('AWS_BEDROCK_ENABLED', 'True').lower() == 'true'

# Import boto3
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
except ImportError:
    print("❌ boto3 not installed. Run: pip install boto3")
    sys.exit(1)


def check_credentials():
    """Check if AWS credentials are configured"""
    print("\n" + "="*60)
    print("1. CHECKING AWS CREDENTIALS")
    print("="*60)

    if not AWS_AI_ACCESS_KEY_ID or not AWS_AI_SECRET_ACCESS_KEY:
        print("❌ AWS AI credentials not configured in .env")
        print("   Required: AWS_AI_ACCESS_KEY_ID, AWS_AI_SECRET_ACCESS_KEY")
        print(f"   .env file location: {env_path}")
        return False

    print(f"✅ AWS_AI_ACCESS_KEY_ID: {AWS_AI_ACCESS_KEY_ID[:8]}...")
    print(f"✅ AWS_AI_SECRET_ACCESS_KEY: {'*' * 20}")
    print(f"✅ AWS_AI_REGION: {AWS_AI_REGION}")

    # Test credentials validity
    try:
        sts = boto3.client(
            'sts',
            aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
            region_name=AWS_AI_REGION
        )
        identity = sts.get_caller_identity()
        print(f"✅ Credentials valid for: {identity['Arn']}")
        print(f"   Account ID: {identity['Account']}")
        return True
    except Exception as e:
        print(f"❌ Credentials invalid: {str(e)}")
        return False


def check_textract():
    """Check Textract access"""
    print("\n" + "="*60)
    print("2. CHECKING TEXTRACT ACCESS")
    print("="*60)

    if not AWS_TEXTRACT_ENABLED:
        print("⚠️  Textract is disabled in settings (AWS_TEXTRACT_ENABLED=False)")
        return False

    print(f"Region: {AWS_TEXTRACT_REGION}")

    try:
        textract = boto3.client(
            'textract',
            aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
            region_name=AWS_TEXTRACT_REGION
        )

        # Create a simple test image (1x1 white pixel PNG)
        test_image = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        response = textract.detect_document_text(
            Document={'Bytes': test_image}
        )

        print("✅ Textract is accessible and working")
        print(f"   Test successful - detected {len(response.get('Blocks', []))} blocks")
        return True

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        if error_code == 'AccessDeniedException':
            print("❌ Textract access denied")
            print(f"   Error: {error_message}")
            print("   → Add 'textract:DetectDocumentText' to IAM policy")
        else:
            print(f"❌ Textract error: {error_code}")
            print(f"   Message: {error_message}")
        return False
    except Exception as e:
        print(f"❌ Textract error: {str(e)}")
        return False


def check_bedrock():
    """Check Bedrock and Claude model access"""
    print("\n" + "="*60)
    print("3. CHECKING BEDROCK & CLAUDE ACCESS")
    print("="*60)

    if not AWS_BEDROCK_ENABLED:
        print("⚠️  Bedrock is disabled in settings (AWS_BEDROCK_ENABLED=False)")
        return False

    print(f"Model ID: {AWS_BEDROCK_MODEL_ID}")
    print(f"Region: {AWS_BEDROCK_REGION}")

    try:
        bedrock = boto3.client(
            'bedrock-runtime',
            aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
            region_name=AWS_BEDROCK_REGION
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
            modelId=AWS_BEDROCK_MODEL_ID,
            body=json.dumps(test_request)
        )

        print("✅ Bedrock is accessible")
        print("✅ Claude model access granted")
        print("   Test invocation successful")
        return True

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        if error_code == 'AccessDeniedException':
            print("❌ Bedrock access denied")
            print(f"   Error: {error_message}")

            if 'Marketplace' in error_message or 'marketplace' in error_message:
                print("\n   🔧 ISSUE: AWS Marketplace Permissions Missing")
                print("   Your IAM user needs AWS Marketplace permissions.")
            elif 'model access' in error_message.lower() or 'not enabled' in error_message.lower():
                print("\n   🔧 ISSUE: Bedrock Model Access Not Granted")
                print("   You need to request access to Claude models in Bedrock Console.")
            else:
                print("\n   🔧 ISSUE: IAM permissions missing for Bedrock")
                print("   Add 'bedrock:InvokeModel' to IAM policy")
        elif error_code == 'ResourceNotFoundException':
            print("❌ Model not found")
            print(f"   The model '{AWS_BEDROCK_MODEL_ID}' doesn't exist or isn't available in {AWS_BEDROCK_REGION}")
            print("   Try: anthropic.claude-3-5-sonnet-20241022-v2:0")
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
    print("HOW TO FIX")
    print("="*60)

    print("\n📋 STEP 1: Update IAM Policy (Add Marketplace Permissions)")
    print("-" * 60)
    print("\n  Option A: AWS Console (Easiest)")
    print("  1. Go to: https://console.aws.amazon.com/iam/home#/users")
    print("  2. Click on your IAM user")
    print("  3. Go to 'Permissions' tab")
    print("  4. Click 'Add permissions' → 'Create inline policy'")
    print("  5. Click 'JSON' tab")
    print("  6. Paste the policy from: docs/supplier_bills/iam_policy.json")
    print("  7. Name it 'PrintCloudAIScanning'")
    print("  8. Click 'Create policy'")

    print("\n  Option B: AWS CLI")
    print("  Get your IAM username first:")
    print("    aws sts get-caller-identity")
    print()
    print("  Then apply the policy:")
    print("    aws iam put-user-policy \\")
    print("      --user-name YOUR_USERNAME \\")
    print("      --policy-name PrintCloudAIScanning \\")
    print("      --policy-document file://docs/supplier_bills/iam_policy.json")

    print("\n📋 STEP 2: Request Bedrock Model Access")
    print("-" * 60)
    print("  1. Go to: https://console.aws.amazon.com/bedrock/")
    print("  2. ⚠️  IMPORTANT: Select region 'us-east-1' (top right corner)")
    print("  3. Click 'Model access' in left sidebar")
    print("  4. Click 'Request model access' or 'Manage model access' button")
    print("  5. Find 'Anthropic' section")
    print("  6. Check ✅ 'Claude 3.5 Sonnet v2'")
    print("  7. Optionally check 'Claude 3 Haiku' (cheaper model)")
    print("  8. Click 'Request model access' at the bottom")
    print("  9. Wait 30-60 seconds")
    print("  10. Refresh the page - status should show 'Access granted' ✅")

    print("\n📋 STEP 3: Verify the Fix")
    print("-" * 60)
    print("  Run this script again:")
    print("    python backend/scripts/diagnose_aws_simple.py")
    print()
    print("  All checks should pass ✅")

    print("\n💡 TIPS")
    print("-" * 60)
    print("  • The IAM policy update is instant")
    print("  • Bedrock model access usually takes 30-60 seconds")
    print("  • Make sure you're in the correct AWS region (us-east-1)")
    print("  • The updated IAM policy includes all required permissions:")
    print("    - textract:DetectDocumentText")
    print("    - bedrock:InvokeModel")
    print("    - aws-marketplace:ViewSubscriptions")
    print("    - aws-marketplace:Subscribe")


def main():
    """Run all diagnostic checks"""
    print("\n" + "="*60)
    print("AWS CONFIGURATION DIAGNOSTIC")
    print("="*60)
    print(f".env file: {env_path}")
    print(f"Exists: {env_path.exists()}")

    if not env_path.exists():
        print("\n❌ .env file not found!")
        print(f"   Expected location: {env_path}")
        print("   Create a .env file with AWS credentials")
        return 1

    results = []

    # Run checks
    results.append(("Credentials", check_credentials()))
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
        print("\n🎉 ALL CHECKS PASSED!")
        print("\nYour AWS configuration is correct.")
        print("You can now test bill scanning:")
        print("  cd backend")
        print("  python manage.py shell")
        print("  >>> from apps.purchases.services.ai_extraction import AIExtractionService")
        print("  >>> svc = AIExtractionService()")
        print("  >>> # Test with your sample bill...")
    else:
        print("\n⚠️  SOME CHECKS FAILED")
        print("\nFollow the instructions below to fix the issues:")
        print_fix_instructions()

    print("\n" + "="*60)

    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
