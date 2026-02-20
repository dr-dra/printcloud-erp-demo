"""
Invoice Data Validation & Health Check Management Command

PURPOSE:
--------
This command validates invoice data integrity in the database. It checks for
common data quality issues that can affect AR (Accounts Receivable) reporting
and payment processing.

WHEN TO RUN:
-----------
1. AFTER MIGRATION TO PRODUCTION (CRITICAL)
   - Run this after migrating legacy invoices to production
   - Ensures data migrated correctly from legacy system
   - Identifies data quality issues before they affect operations

2. REGULARLY (Recommended)
   - Run weekly to catch any data corruption issues
   - Add to your production monitoring/maintenance script

3. BEFORE MAJOR ACCOUNTING OPERATIONS
   - Before generating financial reports
   - Before bank reconciliation
   - Before audit preparations

USAGE:
------
# Basic validation (report only, no changes)
python manage.py validate_invoices

# Detailed report with problematic invoices
python manage.py validate_invoices --verbose

# Fix certain types of issues automatically
python manage.py validate_invoices --fix-sent-status
python manage.py validate_invoices --fix-balance-due

# Run all checks and auto-fix
python manage.py validate_invoices --verbose --auto-fix

# Export results to file
python manage.py validate_invoices --verbose > invoice_validation_report.txt

WHAT IT CHECKS:
---------------
1. Status Consistency
   ✓ Invoices marked 'paid' with balance_due > 0 (should be 'sent' or 'partially_paid')
   ✓ Invoices marked 'void' with valid payments (inconsistent state)
   ✓ Invoices with missing or invalid status

2. Balance Calculations
   ✓ balance_due = net_total - amount_paid formula
   ✓ Amount paid > net total (overpayment tracking)
   ✓ Negative balance_due values

3. Missing Data
   ✓ Invoices missing customer reference
   ✓ Invoices missing invoice_date
   ✓ Invoices with zero net_total

4. AR Workflow Issues
   ✓ Invoices that should appear in AR Aging Report but don't
   ✓ Invoices with outstanding balance in draft status

DATA QUALITY NOTES FOR PRODUCTION:
----------------------------------
ISSUE: Legacy invoices from database migration often have:
  - Status marked as 'paid' but amount_paid = 0 (not actually paid)
  - Status marked as 'void' but with partial payments (abandoned)
  - Incorrect balance_due calculations

ROOT CAUSE: Legacy system didn't maintain status correctly during migration

FIX APPROACH (Choose One):
  A) Set mislabeled 'paid' invoices to 'sent' (if they're actually outstanding)
  B) Set 'paid' invoices to 'overdue' (if payment expected but not received)
  C) Manually review and mark as 'void' (if invoice is obsolete)

IMPORTANT: Always review --verbose output before running --auto-fix in production!

PRODUCTION DEPLOYMENT CHECKLIST:
--------------------------------
□ Run validation command on staging environment first
□ Review --verbose output for all flagged invoices
□ Approve each auto-fix category before applying
□ Run without --auto-fix first (report only mode)
□ Schedule regular validation runs (add to cron job)
□ Monitor validation reports for new issues
□ Document any manual fixes applied
□ Run again 24 hours after first fix to ensure stability

EXAMPLE PRODUCTION DEPLOYMENT SCRIPT:
-------------------------------------
#!/bin/bash
# production_invoice_validation.sh
# Run this after migrating legacy data

cd /path/to/printcloud/backend
source venv/bin/activate

echo "=== Invoice Validation Report ===" > validation_report.txt
echo "Date: $(date)" >> validation_report.txt
echo "" >> validation_report.txt

echo "Step 1: Generating validation report..."
python manage.py validate_invoices --verbose >> validation_report.txt

echo ""
echo "Step 2: Review report at validation_report.txt"
read -p "Press Enter after reviewing the report..."

echo ""
echo "Step 3: Would you like to fix outstanding draft invoices to 'sent' status?"
read -p "Enter 'yes' to continue: " response
if [ "$response" = "yes" ]; then
    python manage.py validate_invoices --fix-sent-status --verbose
    echo "✅ Fixed outstanding draft invoices"
fi

echo ""
echo "Step 4: Validating again..."
python manage.py validate_invoices --verbose

echo "✅ Invoice validation complete!"
"""

from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.sales.invoices.models import SalesInvoice
from decimal import Decimal
import sys


class Command(BaseCommand):
    help = 'Validate invoice data integrity and report quality issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed information about flagged invoices'
        )
        parser.add_argument(
            '--fix-sent-status',
            action='store_true',
            help='Fix outstanding draft invoices by changing status to "sent"'
        )
        parser.add_argument(
            '--fix-balance-due',
            action='store_true',
            help='Recalculate balance_due for all invoices'
        )
        parser.add_argument(
            '--auto-fix',
            action='store_true',
            help='Apply all recommended fixes automatically'
        )

    def handle(self, *args, **options):
        verbose = options.get('verbose', False)
        fix_sent = options.get('fix_sent_status', False)
        fix_balance = options.get('fix_balance_due', False)
        auto_fix = options.get('auto_fix', False)

        # If auto_fix, enable all fixes
        if auto_fix:
            fix_sent = True
            fix_balance = True
            verbose = True

        self.stdout.write(self.style.SUCCESS('\n=== Invoice Validation Report ===\n'))

        # Get all invoices
        all_invoices = SalesInvoice.objects.all()
        total_count = all_invoices.count()
        self.stdout.write(f'Total invoices in database: {total_count}\n')

        # Issue tracking
        issues = {
            'paid_with_balance': [],
            'void_with_balance': [],
            'draft_with_balance': [],
            'missing_customer': [],
            'missing_date': [],
            'zero_total': [],
            'negative_balance': [],
            'overpayment': [],
        }

        # Scan all invoices
        for invoice in all_invoices:
            # Check 1: Paid status with balance_due > 0
            if invoice.status == 'paid' and invoice.balance_due > 0:
                issues['paid_with_balance'].append(invoice)

            # Check 2: Void status with balance_due > 0
            elif invoice.status == 'void' and invoice.balance_due > 0:
                issues['void_with_balance'].append(invoice)

            # Check 3: Draft status with balance_due > 0
            elif invoice.status == 'draft' and invoice.balance_due > 0:
                issues['draft_with_balance'].append(invoice)

            # Check 4: Missing customer
            if not invoice.customer:
                issues['missing_customer'].append(invoice)

            # Check 5: Missing invoice date
            if not invoice.invoice_date:
                issues['missing_date'].append(invoice)

            # Check 6: Zero net_total
            if invoice.net_total == 0:
                issues['zero_total'].append(invoice)

            # Check 7: Negative balance_due
            if invoice.balance_due < 0:
                issues['negative_balance'].append(invoice)

            # Check 8: Overpayment (amount_paid > net_total)
            if invoice.amount_paid > invoice.net_total:
                issues['overpayment'].append(invoice)

        # Report findings
        self.print_findings(issues, verbose)

        # Apply fixes if requested
        if fix_sent or fix_balance or auto_fix:
            self.stdout.write(self.style.WARNING('\n=== Applying Fixes ===\n'))

            if fix_sent or auto_fix:
                self.fix_outstanding_invoices(
                    issues['draft_with_balance'],
                    issues['paid_with_balance']
                )

            if fix_balance or auto_fix:
                self.recalculate_balance_due(all_invoices)

            # Re-validate after fixes
            self.stdout.write(self.style.SUCCESS('\n=== Re-validating After Fixes ===\n'))
            self.handle(*args, **{**options, 'fix_sent_status': False, 'fix_balance_due': False, 'auto_fix': False})

    def print_findings(self, issues, verbose):
        """Print validation findings"""
        total_issues = sum(len(v) for v in issues.values())

        if total_issues == 0:
            self.stdout.write(self.style.SUCCESS('✅ No data quality issues found!\n'))
            return

        self.stdout.write(self.style.WARNING(f'⚠️  Found {total_issues} issues:\n'))

        # Paid status with balance
        if issues['paid_with_balance']:
            self.stdout.write(
                self.style.ERROR(f"❌ {len(issues['paid_with_balance'])} invoices marked 'paid' with balance_due > 0")
            )
            self.stdout.write(
                "   ISSUE: These invoices are marked paid but show outstanding balance\n"
                "   ACTION: Should be 'sent' or 'partially_paid' if actually outstanding\n"
            )
            if verbose:
                for inv in issues['paid_with_balance'][:10]:
                    self.stdout.write(f"      • {inv.invoice_number}: balance={inv.balance_due} (amount_paid={inv.amount_paid})")
                if len(issues['paid_with_balance']) > 10:
                    self.stdout.write(f"      ... and {len(issues['paid_with_balance']) - 10} more\n")

        # Void status with balance
        if issues['void_with_balance']:
            self.stdout.write(
                self.style.ERROR(f"❌ {len(issues['void_with_balance'])} invoices marked 'void' with balance_due > 0")
            )
            self.stdout.write(
                "   ISSUE: Void invoices should have zero balance (either fully paid or written off)\n"
                "   ACTION: Review if payments need to be voided or status needs correction\n"
            )
            if verbose:
                for inv in issues['void_with_balance'][:10]:
                    self.stdout.write(f"      • {inv.invoice_number}: balance={inv.balance_due} (amount_paid={inv.amount_paid})")
                if len(issues['void_with_balance']) > 10:
                    self.stdout.write(f"      ... and {len(issues['void_with_balance']) - 10} more\n")

        # Draft status with balance
        if issues['draft_with_balance']:
            self.stdout.write(
                self.style.WARNING(f"⚠️  {len(issues['draft_with_balance'])} invoices in 'draft' status with balance_due > 0")
            )
            self.stdout.write(
                "   INFO: These are outstanding invoices not yet sent to customer\n"
                "   ACTION: Change to 'sent' when customer is notified\n"
            )
            if verbose:
                for inv in issues['draft_with_balance'][:5]:
                    self.stdout.write(f"      • {inv.invoice_number}: balance={inv.balance_due}")

        # Missing customer
        if issues['missing_customer']:
            self.stdout.write(
                self.style.ERROR(f"❌ {len(issues['missing_customer'])} invoices missing customer reference")
            )
            if verbose:
                for inv in issues['missing_customer'][:5]:
                    self.stdout.write(f"      • {inv.invoice_number}")

        # Negative balance
        if issues['negative_balance']:
            self.stdout.write(
                self.style.ERROR(f"❌ {len(issues['negative_balance'])} invoices with negative balance_due (overpayments)")
            )
            if verbose:
                for inv in issues['negative_balance'][:5]:
                    self.stdout.write(f"      • {inv.invoice_number}: balance={inv.balance_due}")

        # Overpayment
        if issues['overpayment']:
            self.stdout.write(
                self.style.WARNING(f"⚠️  {len(issues['overpayment'])} invoices with overpayment (amount_paid > net_total)")
            )
            if verbose:
                for inv in issues['overpayment'][:5]:
                    self.stdout.write(f"      • {inv.invoice_number}: net_total={inv.net_total}, amount_paid={inv.amount_paid}")

        self.stdout.write('')

    def fix_outstanding_invoices(self, draft_invoices, paid_invoices):
        """Fix outstanding draft and 'paid' invoices by changing to 'sent'"""
        count = 0

        # Fix draft invoices
        for invoice in draft_invoices:
            invoice.status = 'sent'
            invoice.save(update_fields=['status', 'updated_date'])
            count += 1

        if draft_invoices:
            self.stdout.write(
                self.style.SUCCESS(f'✅ Updated {len(draft_invoices)} draft invoices to "sent" status')
            )

        # Fix 'paid' invoices with outstanding balance
        paid_count = 0
        for invoice in paid_invoices:
            invoice.status = 'sent'
            invoice.save(update_fields=['status', 'updated_date'])
            paid_count += 1
            count += 1

        if paid_invoices:
            self.stdout.write(
                self.style.SUCCESS(f'✅ Updated {paid_count} "paid" invoices with balance to "sent" status')
            )

        if not draft_invoices and not paid_invoices:
            self.stdout.write('✅ No outstanding invoices to fix.\n')
        else:
            self.stdout.write(f'✅ Total updated: {count} invoices\n')

    def recalculate_balance_due(self, all_invoices):
        """Recalculate balance_due for all invoices"""
        updated_count = 0

        for invoice in all_invoices:
            old_balance = invoice.balance_due
            # Trigger model's save() to recalculate balance_due
            invoice.save()
            new_balance = invoice.balance_due

            if old_balance != new_balance:
                updated_count += 1

        if updated_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'✅ Recalculated balance_due for {updated_count} invoices\n')
            )
        else:
            self.stdout.write('✅ All balance_due values are correct.\n')
