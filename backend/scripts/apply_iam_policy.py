#!/usr/bin/env python3
"""
Apply IAM policy to enable Bedrock and Textract access
"""

import json
import sys
from pathlib import Path

# Load environment
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

env_config = load_env()
AWS_AI_ACCESS_KEY_ID = env_config.get('AWS_AI_ACCESS_KEY_ID', '')
AWS_AI_SECRET_ACCESS_KEY = env_config.get('AWS_AI_SECRET_ACCESS_KEY', '')
AWS_AI_REGION = env_config.get('AWS_AI_REGION', 'us-east-1')

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("❌ boto3 not installed")
    sys.exit(1)

def main():
    print("\n" + "="*60)
    print("APPLYING IAM POLICY")
    print("="*60)

    # Load policy document
    policy_path = Path(__file__).resolve().parent.parent.parent / 'docs' / 'supplier_bills' / 'iam_policy.json'

    if not policy_path.exists():
        print(f"❌ Policy file not found: {policy_path}")
        return 1

    with open(policy_path, 'r') as f:
        policy_document = f.read()

    # Verify it's valid JSON
    try:
        json.loads(policy_document)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in policy file: {e}")
        return 1

    # Create IAM client
    iam = boto3.client(
        'iam',
        aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
        region_name=AWS_AI_REGION
    )

    # Get current user
    sts = boto3.client(
        'sts',
        aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
        region_name=AWS_AI_REGION
    )

    try:
        identity = sts.get_caller_identity()
        user_arn = identity['Arn']
        username = user_arn.split('/')[-1]

        print(f"IAM User: {username}")
        print(f"Account: {identity['Account']}")
        print(f"Policy: PrintCloudAIScanning")
        print()

        # Apply policy
        print("Applying policy...")
        iam.put_user_policy(
            UserName=username,
            PolicyName='PrintCloudAIScanning',
            PolicyDocument=policy_document
        )

        print("✅ Policy applied successfully!")
        print()
        print("The policy includes permissions for:")
        print("  • AWS Textract (OCR)")
        print("  • AWS Bedrock (Claude AI)")
        print("  • AWS Marketplace (model enablement)")
        print("  • CloudWatch (metrics)")
        print()
        print("Next step: Run diagnostic to test and auto-enable Claude model:")
        print("  python scripts/diagnose_aws_simple.py")

        return 0

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        if error_code == 'AccessDenied':
            print("❌ Access denied")
            print(f"   {error_message}")
            print()
            print("Your IAM user doesn't have permission to modify IAM policies.")
            print("You'll need to:")
            print("  1. Use an AWS account with IAM permissions, OR")
            print("  2. Apply the policy via AWS Console (see GETTING_STARTED.md)")
        else:
            print(f"❌ Error: {error_code}")
            print(f"   {error_message}")

        return 1

    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
