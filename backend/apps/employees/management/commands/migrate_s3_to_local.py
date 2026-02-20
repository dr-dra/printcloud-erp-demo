import os
import urllib.request
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.conf import settings
from apps.employees.models import Employee


class Command(BaseCommand):
    help = 'Migrate existing S3 profile pictures to local storage'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually doing it',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing local files',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force_overwrite = options['force']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        self.stdout.write('Starting S3 to local storage migration...')
        
        # Get all employees with profile pictures
        employees_with_pics = Employee.objects.exclude(profile_picture__isnull=True).exclude(profile_picture__exact='')
        total_count = employees_with_pics.count()
        
        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('No profile pictures found to migrate.'))
            return
        
        self.stdout.write(f'Found {total_count} employees with profile pictures')
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for employee in employees_with_pics:
            try:
                current_pic = str(employee.profile_picture)
                
                # Skip if it's already a local file path (not a URL)
                if not current_pic.startswith('http'):
                    self.stdout.write(f'Skipping {employee.full_name} - already using local storage: {current_pic}')
                    skipped_count += 1
                    continue
                
                # Check if we already have a local file for this employee
                employee_dir = os.path.join(settings.MEDIA_ROOT, 'profile_pictures', f'user_{employee.user.id}')
                if os.path.exists(employee_dir) and os.listdir(employee_dir) and not force_overwrite:
                    self.stdout.write(f'Skipping {employee.full_name} - local file already exists (use --force to overwrite)')
                    skipped_count += 1
                    continue
                
                self.stdout.write(f'Migrating {employee.full_name}: {current_pic}')
                
                if not dry_run:
                    # Download the S3 image
                    try:
                        with urllib.request.urlopen(current_pic, timeout=30) as response:
                            image_data = response.read()
                            
                        # Determine file extension from URL or content type
                        file_extension = '.jpg'  # default
                        if current_pic.lower().endswith(('.png', '.gif', '.jpeg')):
                            file_extension = os.path.splitext(current_pic.lower())[1]
                        
                        # Create a ContentFile and save it to the ImageField
                        image_file = ContentFile(image_data, name=f'profile_pic{file_extension}')
                        
                        # Clear the old field first to avoid conflicts
                        old_field_value = employee.profile_picture
                        employee.profile_picture = None
                        employee.save()
                        
                        # Save the new file
                        employee.profile_picture.save(f'profile_pic{file_extension}', image_file, save=True)
                        
                        migrated_count += 1
                        self.stdout.write(self.style.SUCCESS(f'✓ Migrated {employee.full_name}'))
                        
                    except Exception as download_error:
                        self.stdout.write(self.style.ERROR(f'✗ Failed to download {current_pic}: {download_error}'))
                        error_count += 1
                        continue
                else:
                    # Dry run - just show what would be done
                    self.stdout.write(f'  Would migrate: {current_pic}')
                    migrated_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Error processing {employee.full_name}: {e}'))
                error_count += 1
                continue
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write('Migration Summary:')
        self.stdout.write(f'  Total employees: {total_count}')
        self.stdout.write(f'  Migrated: {migrated_count}')
        self.stdout.write(f'  Skipped: {skipped_count}')
        self.stdout.write(f'  Errors: {error_count}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a DRY RUN - no changes were made.'))
            self.stdout.write('Run without --dry-run to perform the actual migration.')
        elif migrated_count > 0:
            self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully migrated {migrated_count} profile pictures to local storage!'))
        
        if error_count > 0:
            self.stdout.write(self.style.WARNING(f'\n⚠ {error_count} errors occurred during migration.'))