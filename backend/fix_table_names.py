#!/usr/bin/env python3
"""
Script to rename PostgreSQL tables to match current Django model expectations.
This fixes the Git revert issue where table names don't match current models.
"""

import os
import sys
import django
from django.db import connection

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def fix_table_names():
    print("🔧 Fixing table names to match current Django models...")
    
    with connection.cursor() as cursor:
        try:
            # Check if old tables exist
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE 'costing_%'
            """)
            existing_tables = [row[0] for row in cursor.fetchall()]
            print(f"📋 Found existing tables: {existing_tables}")
            
            # Drop old tables if they exist (since we'll recreate via import)
            tables_to_drop = [
                'costing_costing_sheet',
                'costing_costing_estimating'
            ]
            
            for table in tables_to_drop:
                if table in existing_tables:
                    print(f"🗑️  Dropping old table: {table}")
                    cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
            
            print("✅ Old tables dropped successfully!")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    
    return True

if __name__ == "__main__":
    success = fix_table_names()
    if success:
        print("\n🎉 Table names fixed! Now run: python manage.py import_costing")
    else:
        print("\n❌ Failed to fix table names.")
        sys.exit(1)