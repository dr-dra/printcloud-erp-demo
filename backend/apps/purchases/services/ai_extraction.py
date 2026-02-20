"""
AI Extraction Service for Supplier Bills

Handles:
1. AWS Bedrock/Nova integration (multimodal extraction)
2. Supplier matching logic
3. Confidence scoring
"""

import boto3
import json
import logging
import re
import base64
import hashlib
from datetime import date, timedelta
from typing import Dict, Optional, Tuple
from django.conf import settings
from apps.suppliers.models import Supplier
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class AIExtractionService:
    """Service for AI-powered bill data extraction"""

    def __init__(self):
        self.bedrock_client = None
        self.demo_mode = settings.BILL_SCAN_DEMO_MODE

        if settings.AWS_BEDROCK_ENABLED:
            client_kwargs = {
                'service_name': 'bedrock-runtime',
                'region_name': settings.AWS_BEDROCK_REGION,
            }
            if settings.AWS_AI_ACCESS_KEY_ID and settings.AWS_AI_SECRET_ACCESS_KEY:
                client_kwargs['aws_access_key_id'] = settings.AWS_AI_ACCESS_KEY_ID
                client_kwargs['aws_secret_access_key'] = settings.AWS_AI_SECRET_ACCESS_KEY
            self.bedrock_client = boto3.client(**client_kwargs)

    def _build_demo_extraction(
        self,
        file_bytes: bytes,
        file_name: Optional[str] = None,
        reason: str = "bedrock_unavailable",
    ) -> Dict:
        """Generate deterministic demo extraction so scan workflow remains usable without Bedrock."""
        digest = hashlib.md5(file_bytes).hexdigest()
        bill_suffix = digest[:6].upper()
        subtotal_cents = (int(digest[6:12], 16) % 5000000) + 50000
        subtotal = f"{subtotal_cents / 100:.2f}"
        today = date.today()
        due = today + timedelta(days=30)
        summary = f"Demo AI extraction ({reason}). Review values before saving."

        return {
            "bill_number": {"value": f"DEMO-{bill_suffix}", "confidence": 0.55},
            "supplier_name": {"value": None, "confidence": 0.0},
            "bill_date": {"value": today.isoformat(), "confidence": 0.65},
            "due_date": {"value": due.isoformat(), "confidence": 0.60},
            "subtotal": {"value": subtotal, "confidence": 0.55},
            "tax_amount": {"value": "0.00", "confidence": 0.95},
            "total": {"value": subtotal, "confidence": 0.55},
            "discount_amount": {"value": "0.00", "confidence": 0.95},
            "summary": {
                "value": (summary if len(summary) <= 256 else summary[:256]),
                "confidence": 0.45,
            },
            "source_file_name": {
                "value": (file_name or "uploaded-file")[:128],
                "confidence": 1.0,
            },
        }

    def nova_extract_bill_data(
        self,
        file_bytes: bytes,
        file_type: str,
        file_name: Optional[str] = None,
    ) -> Tuple[Dict, Dict]:
        """
        Extract structured bill data using Amazon Nova 2 Lite (multimodal).

        Args:
            file_bytes (bytes): PDF/JPG/PNG file bytes
            file_type (str): MIME type (application/pdf, image/jpeg, etc.)

        Returns:
            Tuple[Dict, Dict]: (extracted_data_with_confidence, raw_nova_response)

        Raises:
            ValueError: If Bedrock is not enabled
            Exception: If extraction or parsing fails
        """
        if not self.bedrock_client:
            if self.demo_mode:
                logger.warning("Using BILL_SCAN_DEMO_MODE because Bedrock client is unavailable")
                return self._build_demo_extraction(file_bytes, file_name), {
                    "mode": "demo",
                    "reason": "bedrock_client_unavailable",
                }
            raise ValueError("Bedrock is not enabled")

        # Encode image/PDF as base64
        image_b64 = base64.b64encode(file_bytes).decode('utf-8')

        # Determine image format for Nova
        image_format = {
            'application/pdf': 'pdf',
            'image/jpeg': 'jpeg',
            'image/jpg': 'jpeg',
            'image/png': 'png'
        }.get(file_type, 'jpeg')

        # System prompt - optimized for bill extraction
        system_prompt = """You are an expert data extraction assistant specializing in supplier invoices and bills.

Extract the following fields from this supplier bill/invoice image:

1. VENDOR/SUPPLIER NAME: The company name issuing the bill (usually at the top)

2. INVOICE/BILL NUMBER: The PRIMARY invoice/bill number for THIS transaction
   - Look for: "Invoice No", "Bill No", "Invoice #", "Credit", or similar labels
   - Usually located at the TOP RIGHT or CENTER of the document
   - IGNORE: "Old Invoice No", "Reference No", "PO Number" - these are NOT the current bill number
   - IMPORTANT: Include ALL characters (letters AND numbers) - e.g., "A014853", "INV-2022-001", "BILL#123"
   - Do NOT remove letter prefixes or suffixes from the bill number

3. INVOICE DATE: The date this bill was issued (format: DD/MM/YYYY or YYYY-MM-DD)
   - Look near the top of the document
   - May include timestamp (ignore the time, just extract the date)

4. DUE DATE: Payment due date (if explicitly stated)
   - Look for: "Due Date", "Payment Due", "Pay By"
   - If not found, return null

5. SUBTOTAL: Total amount before tax
   - Look in the totals section (usually bottom right)
   - May be labeled: "Subtotal", "Sub Total", "Amount"

6. TAX AMOUNT: VAT, GST, or other tax amount
   - Look for: "VAT", "Tax", "GST"
   - Often shows "0.00" if no tax

7. TOTAL: Final total amount due
   - Look for: "Total", "Grand Total", "Amount Due"
   - Usually the largest/boldest number in totals section

8. DISCOUNT: Any discount applied
   - Look for: "Discount", "Less"
   - Often shows "0.00" if no discount

9. BILL SUMMARY: Brief description of what's in the bill (max 256 chars)
   - Scan the line items/description section of the bill
   - Summarize what goods or services are being billed
   - Focus on WHAT is being purchased, not amounts
   - Examples:
     - "Printing services: 5000 brochures, 2000 business cards"
     - "Office supplies: Paper, toner cartridges, folders"
     - "Raw materials: 500kg aluminum sheets, 200kg copper wire"
   - If no clear line items, describe the general category (e.g., "General supplies")
   - Keep it concise and informative (max 256 characters)

Return ONLY a valid JSON object with the following structure:
{
  "bill_number": {"value": "string or null", "confidence": 0.0-1.0},
  "supplier_name": {"value": "string or null", "confidence": 0.0-1.0},
  "bill_date": {"value": "YYYY-MM-DD or null", "confidence": 0.0-1.0},
  "due_date": {"value": "YYYY-MM-DD or null", "confidence": 0.0-1.0},
  "subtotal": {"value": "decimal string or null", "confidence": 0.0-1.0},
  "tax_amount": {"value": "decimal string or null", "confidence": 0.0-1.0},
  "total": {"value": "decimal string or null", "confidence": 0.0-1.0},
  "discount_amount": {"value": "decimal string or null", "confidence": 0.0-1.0},
  "summary": {"value": "string or null", "confidence": 0.0-1.0}
}

CRITICAL RULES:
- Dates MUST be in YYYY-MM-DD format (convert DD/MM/YYYY if needed)
- Amounts MUST be decimal strings without currency symbols (e.g., "198000.00")
- Confidence MUST be between 0.0 and 1.0 (use 0.9+ for clear text, 0.7-0.9 for unclear, <0.7 for very uncertain)
- For bill_number, ONLY extract the MAIN invoice number, NOT old/reference numbers
- Remove commas from numbers (198,000.00 → 198000.00)
- Return null for missing fields with confidence 0.0
- Do NOT include any explanatory text, reasoning, or markdown formatting
- Return ONLY the JSON object"""

        try:
            # Build request body - format depends on model type
            model_id = settings.AWS_BEDROCK_MODEL_ID

            # Check if it's a Claude model (Anthropic) or Nova model (Amazon)
            is_claude = 'anthropic' in model_id.lower() or 'claude' in model_id.lower()
            is_nova = 'nova' in model_id.lower()

            if is_claude:
                # Claude API format (Anthropic)
                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 2000,
                    "temperature": 0.1,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": f"image/{image_format}" if image_format != 'pdf' else "application/pdf",
                                        "data": image_b64
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": system_prompt + "\n\nExtract the invoice data as specified above."
                                }
                            ]
                        }
                    ]
                }
            elif is_nova:
                # Nova API format (Amazon)
                request_body = {
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "image": {
                                        "format": image_format,
                                        "source": {
                                            "bytes": image_b64
                                        }
                                    }
                                },
                                {
                                    "text": system_prompt + "\n\nExtract the invoice data as specified above."
                                }
                            ]
                        }
                    ],
                    "inferenceConfig": {
                        "maxTokens": 2000,
                        "temperature": 0.1,
                        "topP": 0.9
                    }
                }
            else:
                raise ValueError(f"Unsupported model type: {model_id}")

            logger.info(f"Calling model {model_id} with {len(file_bytes)} bytes ({image_format})")
            logger.info(f"Using {'Claude' if is_claude else 'Nova'} API format")

            # Invoke Nova 2 Lite
            response = self.bedrock_client.invoke_model(
                modelId=settings.AWS_BEDROCK_MODEL_ID,
                body=json.dumps(request_body)
            )

            # Parse response
            response_body = json.loads(response['body'].read())
            logger.info(f"Response structure: {list(response_body.keys())}")

            # Extract content - format depends on model type
            raw_text = None

            if is_claude:
                # Claude response format
                content = response_body.get('content', [])
                if content:
                    for block in content:
                        if block.get('type') == 'text':
                            raw_text = block.get('text', '')
                            break

            elif is_nova:
                # Nova response format
                if 'output' in response_body:
                    content = response_body.get('output', {}).get('message', {}).get('content', [])
                    if content:
                        raw_text = content[0].get('text', '')
                elif 'content' in response_body:
                    content = response_body.get('content', [])
                    if content:
                        raw_text = content[0].get('text', '')

            if not raw_text:
                logger.error(f"Could not extract text from response: {response_body}")
                raise Exception(f"Empty response from model {model_id}")

            logger.info(f"Nova 2 Lite returned {len(raw_text)} characters")

            # ROBUST JSON PARSING
            # Nova may include reasoning/thinking blocks before JSON
            # Use regex to extract only the JSON object
            json_match = re.search(
                r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
                raw_text,
                re.DOTALL
            )

            if not json_match:
                logger.error(f"No JSON found in Nova response: {raw_text[:500]}")
                raise Exception("Could not extract JSON from Nova response")

            json_str = json_match.group(0)
            extracted_data = json.loads(json_str)

            # Validate and fix structure
            required_fields = [
                'bill_number', 'supplier_name', 'bill_date', 'due_date',
                'subtotal', 'tax_amount', 'total', 'discount_amount', 'summary'
            ]

            for field in required_fields:
                if field not in extracted_data:
                    extracted_data[field] = {"value": None, "confidence": 0.0}
                elif not isinstance(extracted_data[field], dict):
                    # Fix malformed field
                    extracted_data[field] = {"value": extracted_data[field], "confidence": 0.5}
                elif 'value' not in extracted_data[field]:
                    extracted_data[field]['value'] = None
                elif 'confidence' not in extracted_data[field]:
                    extracted_data[field]['confidence'] = 0.5

            logger.info(f"Successfully extracted {len(extracted_data)} fields")

            return extracted_data, response_body

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Raw response: {raw_text[:1000] if 'raw_text' in locals() else 'N/A'}")
            if self.demo_mode:
                logger.warning("Falling back to BILL_SCAN_DEMO_MODE due to JSON parse failure")
                return self._build_demo_extraction(file_bytes, file_name, "invalid_model_json"), {
                    "mode": "demo",
                    "reason": "invalid_model_json",
                }
            raise Exception(f"Invalid JSON in Nova response: {str(e)}")
        except Exception as e:
            logger.error(f"Nova extraction failed: {str(e)}")
            if self.demo_mode:
                logger.warning("Falling back to BILL_SCAN_DEMO_MODE due to Bedrock invocation failure")
                return self._build_demo_extraction(file_bytes, file_name, "bedrock_invoke_error"), {
                    "mode": "demo",
                    "reason": "bedrock_invoke_error",
                    "error": str(e),
                }
            raise

    def match_supplier(
        self,
        supplier_name: str,
        confidence: float
    ) -> Tuple[Optional[Supplier], float]:
        """
        Step 3: Match extracted supplier name to existing suppliers

        Returns: (matched_supplier, match_confidence)
        """
        if not supplier_name or confidence < 0.5:
            return None, 0.0

        # Get all active suppliers
        suppliers = Supplier.objects.filter(is_active=True)

        best_match = None
        best_score = 0.0

        for supplier in suppliers:
            # Calculate similarity scores
            name_score = SequenceMatcher(
                None,
                supplier_name.lower(),
                supplier.name.lower()
            ).ratio()

            company_score = 0.0
            if supplier.company_name:
                company_score = SequenceMatcher(
                    None,
                    supplier_name.lower(),
                    supplier.company_name.lower()
                ).ratio()

            # Take the better score
            score = max(name_score, company_score)

            if score > best_score:
                best_score = score
                best_match = supplier

        # Require at least 75% similarity for auto-match
        if best_score >= 0.75:
            # Combine extraction confidence with match confidence
            final_confidence = (confidence + best_score) / 2
            return best_match, final_confidence

        return None, 0.0

    def process_bill_scan(
        self,
        file_bytes: bytes,
        file_type: str,
        file_name: Optional[str] = None,
    ) -> Dict:
        """
        Complete extraction pipeline using Nova 2 Lite

        Returns: {
            'nova_response': dict,
            'extracted_data': dict,
            'matched_supplier_id': int or None,
            'supplier_match_confidence': float
        }
        """
        # Step 1: Extract data using Nova 2 Lite (single-stage: vision + extraction)
        structured_data, nova_response = self.nova_extract_bill_data(
            file_bytes,
            file_type,
            file_name,
        )

        # Step 2: Match supplier
        supplier_name = structured_data.get('supplier_name', {}).get('value')
        supplier_confidence = structured_data.get('supplier_name', {}).get('confidence', 0.0)

        matched_supplier, match_confidence = self.match_supplier(
            supplier_name,
            supplier_confidence
        )

        return {
            'nova_response': nova_response,
            'extracted_data': structured_data,
            'matched_supplier_id': matched_supplier.id if matched_supplier else None,
            'supplier_match_confidence': match_confidence
        }
