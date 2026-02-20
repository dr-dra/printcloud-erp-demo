# migrate_costing.py

import json
import pymysql
import pymysql.cursors
import psycopg2
from psycopg2.extras import RealDictCursor
from django.core.management.base import BaseCommand
from django.conf import settings
from typing import Dict, Any


class Command(BaseCommand):
    help = 'Migrate costing data from MySQL database to PostgreSQL'

    def add_arguments(self, parser):
        parser.add_argument('--limit-estimating', type=int, default=100)
        parser.add_argument('--limit-sheet', type=int, default=1000)
        parser.add_argument('--debug', action='store_true')

    def handle(self, *args, **options):
        limit_estimating = options['limit_estimating']
        limit_sheet = options['limit_sheet']
        debug = options['debug']

        postgres = settings.DATABASES['default']
        mysql = settings.DATABASES['mysql']

        pg_conn = psycopg2.connect(
            host=postgres['HOST'],
            database=postgres['NAME'],
            user=postgres['USER'],
            password=postgres['PASSWORD'],
            port=postgres.get('PORT', 5432)
        )
        pg_conn.autocommit = True
        pg_cursor = pg_conn.cursor()

        mysql_conn = pymysql.connect(
            host=mysql['HOST'],
            user=mysql['USER'],
            password=mysql['PASSWORD'],
            database=mysql['NAME'],
            port=int(mysql.get('PORT', 3306)),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        mysql_cursor = mysql_conn.cursor()

        print("🚀 Connected to both databases")

        # Drop + create tables
        pg_cursor.execute("DROP TABLE IF EXISTS costing_costing_estimating CASCADE")
        pg_cursor.execute("DROP TABLE IF EXISTS costing_costing_sheet CASCADE")

        pg_cursor.execute("""
        CREATE TABLE costing_costing_estimating (
            id SERIAL PRIMARY KEY,
            "costingId" INTEGER NOT NULL,
            "customerId" INTEGER,
            "customerName" VARCHAR(255),
            "projectName" VARCHAR(255),
            notes TEXT,
            "isOutbound" SMALLINT DEFAULT 0,
            "isActive" INTEGER DEFAULT 1,
            "companyId" INTEGER,
            "createdBy" INTEGER,
            "createdDate" TIMESTAMP,
            "updatedBy" INTEGER,
            "updatedDate" TIMESTAMP
        );""")

        pg_cursor.execute("""
        CREATE TABLE costing_costing_sheet (
            id SERIAL PRIMARY KEY,
            "costingId" INTEGER NOT NULL,
            quantity DECIMAL(20,2),
            "subTotal" DECIMAL(20,2),
            "profitMargin" DECIMAL(20,2),
            "profitAmount" DECIMAL(20,2),
            "taxPercentage" DECIMAL(20,2),
            "taxProfitAmount" DECIMAL(20,2),
            total DECIMAL(20,2),
            "unitPrice" DECIMAL(20,2),
            formulas JSONB,
            "activeSheet" SMALLINT DEFAULT 0,
            is_locked SMALLINT DEFAULT 0
        );""")

        print("✅ Tables created")

        mysql_cursor.execute(f"SELECT * FROM costing_estimating ORDER BY id DESC LIMIT {limit_estimating}")
        estimating = mysql_cursor.fetchall()

        for row in estimating:
            # Type annotation to help with dictionary access
            row_dict = row  # pymysql.cursors.DictCursor returns dict
            vals = (
                row_dict['id'], row_dict['costingId'], row_dict['customerId'], row_dict['customerName'],
                row_dict['projectName'], row_dict['notes'], row_dict['isOutbound'], row_dict['isActive'],
                row_dict['companyId'], row_dict['createdBy'], row_dict['createdDate'], row_dict['updatedBy'], row_dict['updatedDate']
            )
            pg_cursor.execute("""
                INSERT INTO costing_costing_estimating (
                    id, "costingId", "customerId", "customerName", "projectName", notes,
                    "isOutbound", "isActive", "companyId", "createdBy", "createdDate",
                    "updatedBy", "updatedDate")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, vals)

        print(f"✅ Inserted {len(estimating)} estimating records")

        mysql_cursor.execute(f"SELECT * FROM costing_sheet ORDER BY id DESC LIMIT {limit_sheet}")
        sheets = mysql_cursor.fetchall()

        for row in sheets:
            # Type annotation to help with dictionary access
            row_dict = row  # pymysql.cursors.DictCursor returns dict
            corrected_id = row_dict['costingId'] - 97 if row_dict['costingId'] else None
            formulas_json = row_dict['formulas']
            try:
                json.loads(formulas_json)
            except:
                formulas_json = json.dumps({"error": "invalid"})

            vals = (
                row_dict['id'], corrected_id, row_dict['quantity'], row_dict['subTotal'],
                row_dict['profitMargin'], row_dict['profitAmount'], row_dict['taxPercentage'],
                row_dict['taxProfitAmount'], row_dict['total'], row_dict['unitPrice'],
                formulas_json, int(bool(row_dict['activeSheet'])), int(bool(row_dict['is_locked']))
            )
            pg_cursor.execute("""
                INSERT INTO costing_costing_sheet (
                    id, "costingId", quantity, "subTotal", "profitMargin", "profitAmount",
                    "taxPercentage", "taxProfitAmount", total, "unitPrice", formulas,
                    "activeSheet", is_locked)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, vals)

        print(f"✅ Inserted {len(sheets)} costing_sheet records")

        pg_cursor.close()
        pg_conn.close()
        mysql_conn.close()
        print("🎉 Migration complete!")
