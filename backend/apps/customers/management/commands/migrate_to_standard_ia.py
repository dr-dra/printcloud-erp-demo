from django.core.management.base import BaseCommand
from django.conf import settings
import boto3
import sys
import os
from django.db import connections
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import datetime
from apps.employees.models import Employee
from apps.users.models import User
import json
from apps.customers.models import CustomerDocument

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

class Command(BaseCommand):
    help = 'Migrate existing S3 files to Standard-IA storage class for cost optimization'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually doing it',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of files to process in each batch (default: 100)',
        )

    def handle(self, *args, **options):
        if not all([settings.AWS_ACCESS_KEY_ID, settings.AWS_SECRET_ACCESS_KEY, settings.AWS_STORAGE_BUCKET_NAME]):
            self.stdout.write(self.style.ERROR('❌ AWS credentials not configured'))
            return

        # Initialize S3 client
        s3 = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME or 'ap-south-1'
        )

        dry_run = options['dry_run']
        batch_size = options['batch_size']

        self.stdout.write(f"🔍 Scanning customer documents...")
        
        # Get all customer documents
        documents = CustomerDocument.objects.exclude(file='')
        total_docs = documents.count()
        
        if total_docs == 0:
            self.stdout.write(self.style.WARNING('⚠️  No customer documents found'))
            return

        self.stdout.write(f"📄 Found {total_docs} customer documents")
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🧪 DRY RUN MODE - No changes will be made'))
        
        migrated_count = 0
        error_count = 0
        already_ia_count = 0
        
        for i, doc in enumerate(documents, 1):
            if not doc.file:
                continue
                
            try:
                # Get current object metadata
                response = s3.head_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=doc.file.name
                )
                
                current_storage_class = response.get('StorageClass', 'STANDARD')
                file_size = response.get('ContentLength', 0)
                
                # Skip if already in Standard-IA
                if current_storage_class == 'STANDARD_IA':
                    already_ia_count += 1
                    self.stdout.write(f"✅ [{i}/{total_docs}] {doc.file.name} - Already Standard-IA")
                    continue
                
                # Calculate cost savings
                size_mb = file_size / (1024 * 1024)
                monthly_savings = size_mb * 0.001 * 0.4  # 40% savings on Standard-IA
                
                if dry_run:
                    self.stdout.write(
                        f"🔄 [{i}/{total_docs}] Would migrate: {doc.file.name} "
                        f"({size_mb:.2f}MB, ${monthly_savings:.4f}/month savings)"
                    )
                else:
                    # Copy object to Standard-IA
                    s3.copy_object(
                        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                        CopySource={
                            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                            'Key': doc.file.name
                        },
                        Key=doc.file.name,
                        StorageClass='STANDARD_IA',
                        MetadataDirective='COPY'
                    )
                    
                    migrated_count += 1
                    self.stdout.write(
                        f"✅ [{i}/{total_docs}] Migrated: {doc.file.name} "
                        f"({size_mb:.2f}MB, ${monthly_savings:.4f}/month savings)"
                    )
                
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"❌ [{i}/{total_docs}] Error with {doc.file.name}: {str(e)}")
                )
            
            # Progress update for large batches
            if i % batch_size == 0:
                self.stdout.write(f"📊 Progress: {i}/{total_docs} processed...")
        
        # Summary
        self.stdout.write("\n" + "="*50)
        self.stdout.write("📋 MIGRATION SUMMARY")
        self.stdout.write("="*50)
        
        if dry_run:
            self.stdout.write(f"🔍 Total documents scanned: {total_docs}")
            self.stdout.write(f"✅ Already Standard-IA: {already_ia_count}")
            self.stdout.write(f"🔄 Would migrate: {total_docs - already_ia_count - error_count}")
            self.stdout.write(f"❌ Errors: {error_count}")
            self.stdout.write(f"\n💡 Run without --dry-run to perform actual migration")
        else:
            self.stdout.write(f"📄 Total documents: {total_docs}")
            self.stdout.write(f"✅ Successfully migrated: {migrated_count}")
            self.stdout.write(f"🔄 Already Standard-IA: {already_ia_count}")
            self.stdout.write(f"❌ Errors: {error_count}")
            
            if migrated_count > 0:
                self.stdout.write(f"\n💰 Estimated monthly savings: ~${migrated_count * 0.001 * 0.4:.2f}")
                self.stdout.write(f"💰 Estimated annual savings: ~${migrated_count * 0.001 * 0.4 * 12:.2f}")
        
        self.stdout.write("\n🎉 Migration complete!")
        
        if not dry_run and migrated_count > 0:
            self.stdout.write("📈 Cost savings will be reflected in your next AWS bill")
            self.stdout.write("🔍 Monitor your S3 costs in AWS CloudWatch") 