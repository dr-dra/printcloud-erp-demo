"""
Create opening balance journal entry from a CSV or JSON input file.

Usage:
  python manage.py create_opening_balances --as-of 2026-03-31 --input path/to/opening_balances.csv
"""

import csv
import json
from decimal import Decimal
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from apps.accounting.models import ChartOfAccounts, JournalEntry
from apps.accounting.services.journal_engine import JournalEngine


class Command(BaseCommand):
    help = 'Create opening balance journal entry from input file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--as-of',
            dest='as_of',
            required=True,
            help='Opening balance date (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--input',
            dest='input_path',
            required=True,
            help='Path to CSV or JSON file containing opening balances',
        )

    def handle(self, *args, **options):
        as_of = options['as_of']
        input_path = options['input_path']

        try:
            as_of_date = datetime.strptime(as_of, '%Y-%m-%d').date()
        except ValueError as exc:
            raise CommandError('Invalid --as-of date. Use YYYY-MM-DD.') from exc

        if JournalEntry.objects.filter(
            source_type='opening_balance',
            event_type='opening_balance',
            entry_date=as_of_date,
        ).exists():
            raise CommandError('Opening balances already exist for this date.')

        entries = self._load_entries(input_path)
        if not entries:
            raise CommandError('Input file did not contain any opening balance rows.')

        lines_data = []
        for entry in entries:
            account_code = entry.get('account_code')
            amount = entry.get('amount')
            description = entry.get('description')

            if not account_code:
                raise CommandError('Missing account_code in input row.')

            try:
                amount_value = Decimal(str(amount))
            except Exception as exc:
                raise CommandError(f'Invalid amount for account {account_code}.') from exc

            if amount_value == 0:
                continue

            account = ChartOfAccounts.objects.get(account_code=account_code)
            debit, credit = self._to_debit_credit(account, amount_value)

            lines_data.append({
                'account_code': account.account_code,
                'debit': debit,
                'credit': credit,
                'description': description or f'Opening balance - {account.account_name}',
            })

        if not lines_data:
            raise CommandError('All provided balances were zero.')

        lines_data = self._ensure_balanced(lines_data)

        journal = JournalEngine.create_journal_entry(
            entry_date=as_of_date,
            source_type='opening_balance',
            source_id=None,
            event_type='opening_balance',
            description=f'Opening balances as of {as_of_date}',
            lines_data=lines_data,
            created_by=None,
            auto_post=True,
        )

        self.stdout.write(self.style.SUCCESS(
            f'Opening balances created: {journal.journal_number} (DR {journal.total_debit} / CR {journal.total_credit})'
        ))

    def _load_entries(self, input_path):
        if input_path.lower().endswith('.json'):
            with open(input_path, 'r', encoding='utf-8') as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                return data.get('lines', [])
            return data

        if input_path.lower().endswith('.csv'):
            with open(input_path, 'r', encoding='utf-8-sig') as handle:
                reader = csv.DictReader(handle)
                return list(reader)

        raise CommandError('Unsupported input format. Use CSV or JSON.')

    def _to_debit_credit(self, account, amount):
        if account.category.account_type == 'debit_normal':
            debit = amount if amount > 0 else abs(amount)
            credit = Decimal('0') if amount > 0 else Decimal('0')
            if amount < 0:
                credit = abs(amount)
                debit = Decimal('0')
        else:
            credit = amount if amount > 0 else abs(amount)
            debit = Decimal('0') if amount > 0 else Decimal('0')
            if amount < 0:
                debit = abs(amount)
                credit = Decimal('0')
        return debit, credit

    def _ensure_balanced(self, lines_data):
        total_debit = sum(Decimal(str(line['debit'])) for line in lines_data)
        total_credit = sum(Decimal(str(line['credit'])) for line in lines_data)

        if total_debit == total_credit:
            return lines_data

        difference = total_debit - total_credit
        try:
            equity_account = ChartOfAccounts.objects.get(account_code='3000')
        except ChartOfAccounts.DoesNotExist as exc:
            raise CommandError('Opening balances are not balanced and account 3000 is missing.') from exc

        debit = Decimal('0')
        credit = Decimal('0')
        if difference > 0:
            credit = difference
        else:
            debit = abs(difference)

        lines_data.append({
            'account_code': equity_account.account_code,
            'debit': debit,
            'credit': credit,
            'description': 'Opening balance - Owner Capital',
        })

        return lines_data
