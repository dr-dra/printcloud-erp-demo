#!/usr/bin/env python3
"""
Check if IAM policy has been applied
"""

import sys
from pathlib import Path

# Load environment
env_path = Path(__file__).resolve().parent.parent / '.env'

def load_env():
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
    print("CHECKING IAM POLICY STATUS")
    print("="*60)

    # Create clients
    sts = boto3.client(
        'sts',
        aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
        region_name=AWS_AI_REGION
    )

    iam = boto3.client(
        'iam',
        aws_access_key_id=AWS_AI_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_AI_SECRET_ACCESS_KEY,
        region_name=AWS_AI_REGION
    )

    try:
        # Get current user
        identity = sts.get_caller_identity()
        user_arn = identity['Arn']
        username = user_arn.split('/')[-1]

        print(f"IAM User: {username}")

        # Try to list policies
        print("\nAttempting to list user policies...")
        try:
            inline_policies = iam.list_user_policies(UserName=username)
            policy_names = inline_policies.get('PolicyNames', [])

            print(f"\nFound {len(policy_names)} inline policy(ies):")
            for name in policy_names:
                print(f"  • {name}")

            if 'PrintCloudAIScanning' in policy_names:
                print("\n✅ PrintCloudAIScanning policy EXISTS!")
                print("\nBut Bedrock is still failing... Let me check the policy content:")

                policy = iam.get_user_policy(UserName=username, PolicyName='PrintCloudAIScanning')
                import json
                policy_doc = json.loads(policy['PolicyDocument'])
                print(json.dumps(policy_doc, indent=2))

            else:
                print("\n❌ PrintCloudAIScanning policy NOT FOUND!")
                print("\n🔧 ACTION REQUIRED:")
                print("   You need to apply the IAM policy via AWS Console:")
                print("   1. Login to AWS Console with an ADMIN account")
                print("   2. Go to: https://console.aws.amazon.com/iam/home#/users")
                print("   3. Click on user 'printcloud-s3'")
                print("   4. Permissions tab → Add permissions → Create inline policy")
                print("   5. JSON tab → Paste policy from docs/supplier_bills/iam_policy.json")
                print("   6. Name: 'PrintCloudAIScanning' → Create policy")

        except ClientError as e:
            if 'AccessDenied' in str(e):
                print("⚠️  Cannot list IAM policies (user lacks IAM permissions)")
                print("   This is normal - the printcloud-s3 user can't view its own policies.")
                print("\n❌ But based on the diagnostic error, the policy is NOT applied yet.")
                print("\n🔧 ACTION REQUIRED:")
                print("   Apply the IAM policy via AWS Console (see instructions above)")
            else:
                print(f"Error: {e}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return 1

    print("\n" + "="*60)
    return 0

if __name__ == '__main__':
    sys.exit(main())
