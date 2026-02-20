#!/bin/bash

# Quick AWS Configuration Test Script
# Tests AWS Textract and Bedrock access

echo "=========================================="
echo "AWS Configuration Quick Test"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.."
source venv/bin/activate 2>/dev/null || source ../venv/bin/activate 2>/dev/null || true

echo "1. Testing AWS credentials..."
python -c "
import boto3
from decouple import config

try:
    sts = boto3.client('sts', 
        aws_access_key_id=config('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=config('AWS_SECRET_ACCESS_KEY'),
        region_name=config('AWS_S3_REGION_NAME', default='us-east-1')
    )
    identity = sts.get_caller_identity()
    print(f'✅ AWS Credentials valid')
    print(f'   Account: {identity[\"Account\"]}')
    print(f'   User: {identity[\"Arn\"]}')
except Exception as e:
    print(f'❌ Credentials failed: {e}')
    exit(1)
"

echo ""
echo "2. Testing Textract access..."
python -c "
import boto3
from decouple import config

try:
    textract = boto3.client('textract',
        aws_access_key_id=config('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=config('AWS_SECRET_ACCESS_KEY'),
        region_name=config('AWS_S3_REGION_NAME', default='us-east-1')
    )
    response = textract.detect_document_text(
        Document={'Bytes': b'Test Invoice\nAmount: \$100.00'}
    )
    print(f'✅ Textract is working')
    print(f'   Detected {len(response[\"Blocks\"])} blocks')
except Exception as e:
    print(f'❌ Textract failed: {e}')
    print('   Check IAM permissions for textract:DetectDocumentText')
    exit(1)
"

echo ""
echo "3. Testing Bedrock/Claude access..."
python -c "
import boto3
import json
from decouple import config

try:
    bedrock = boto3.client('bedrock-runtime',
        aws_access_key_id=config('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=config('AWS_SECRET_ACCESS_KEY'),
        region_name=config('AWS_S3_REGION_NAME', default='us-east-1')
    )
    
    model_id = config('AWS_BEDROCK_MODEL_ID', default='anthropic.claude-3-5-sonnet-20241022-v2:0')
    
    request = {
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': 20,
        'messages': [{'role': 'user', 'content': 'Say hi in 3 words'}]
    }
    
    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps(request)
    )
    
    result = json.loads(response['body'].read())
    print(f'✅ Bedrock + Claude is working')
    print(f'   Model: {model_id}')
    print(f'   Response: {result[\"content\"][0][\"text\"]}')
except Exception as e:
    print(f'❌ Bedrock failed: {e}')
    print('   Go to AWS Bedrock Console → Model Access')
    print('   Request access to Anthropic Claude models')
    exit(1)
"

echo ""
echo "=========================================="
echo "✅ All AWS services are configured!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Upload a test bill PDF"
echo "2. Monitor Celery logs: tail -f celery.log"
echo "3. Check costs: AWS Console → Billing"
echo ""
