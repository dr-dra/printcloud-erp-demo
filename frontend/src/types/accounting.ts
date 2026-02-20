/**
 * TypeScript types for Accounting Module
 */

// Account Categories
export interface AccountCategory {
  id: number;
  code: string;
  name: string;
  account_type: 'debit_normal' | 'credit_normal';
  display_order: number;
  is_active: boolean;
}

// Chart of Accounts
export interface ChartOfAccount {
  id: number;
  account_code: string;
  account_name: string;
  category: number;
  category_name: string;
  parent_account?: number;
  parent_account_name?: string;
  is_system_account: boolean;
  is_active: boolean;
  allow_transactions: boolean;
  current_balance: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccountList {
  id: number;
  account_code: string;
  account_name: string;
  category_name: string;
  current_balance: string;
  is_active: boolean;
}

export interface BankAccountOption {
  id: number;
  account_code: string;
  account_name: string;
}

// Journal Lines
export interface JournalLine {
  id: number;
  account: number;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
  description?: string;
}

// Journal Entries
export interface JournalEntry {
  id: number;
  journal_number: string;
  entry_date: string;
  entry_type: 'system' | 'manual';
  source_type: string;
  event_type: string;
  source_id?: number;
  source_reference?: string;
  description: string;
  is_posted: boolean;
  posted_at?: string;
  total_debit: string;
  total_credit: string;
  fiscal_period?: number;
  is_reversed: boolean;
  reversed_by?: number;
  reversed_by_name?: string;
  reversed_at?: string;
  reverses?: number;
  reverses_journal_number?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  lines: JournalLine[];
}

export interface JournalEntryList {
  id: number;
  journal_number: string;
  entry_date: string;
  entry_type: 'system' | 'manual';
  source_type: string;
  event_type: string;
  description: string;
  total_debit: string;
  total_credit: string;
  is_posted: boolean;
  is_reversed: boolean;
  created_by_name: string;
}

// Fiscal Periods
export interface FiscalPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'locked';
  closed_at?: string;
  closed_by?: number;
  closed_by_name?: string;
}

// Bank Transactions
export interface BankTransaction {
  id: number;
  transaction_date: string;
  transaction_type: 'receipt' | 'payment' | 'transfer' | 'bank_charge' | 'interest' | 'other';
  amount: string;
  description: string;
  reference_number?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'posted';
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  journal_entry?: number;
  journal_entry_number?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CashDepositPayload {
  date: string;
  amount: string;
  bank_account_id: number;
  reference?: string;
  notes?: string;
}

// Reports
export interface CashBookTransaction {
  date: string;
  journal_number: string;
  journal_entry_id: number;
  description: string;
  source_type: string;
  source_reference?: string;
  type: 'receipt' | 'payment';
  debit: string;
  credit: string;
  amount: string;
  balance: string;
}

export interface CashBookReport {
  period: {
    start_date: string;
    end_date: string;
  };
  opening_balance: string;
  closing_balance: string;
  transactions: CashBookTransaction[];
  total_receipts: string;
  total_payments: string;
}

export interface AgingInvoice {
  invoice_number: string;
  customer: string;
  customer_id: number;
  invoice_date: string;
  due_date: string | null;
  days_outstanding: number;
  age_bucket: string;
  amount: string;
}

export interface ARAgingReport {
  invoices: AgingInvoice[];
  summary: {
    current: string;
    days_1_30: string;
    days_31_60: string;
    days_61_90: string;
    days_90_plus: string;
    total: string;
  };
  customers: unknown[];
}

export interface AgingBill {
  bill_id?: number;
  supplier_id: number;
  supplier_name: string;
  bill_number: string;
  internal_reference: string;
  bill_date: string;
  due_date: string;
  days_outstanding: number;
  age_bucket: string;
  bill_total: string;
  amount_paid: string;
  balance_due: string;
}

export interface APAgingReport {
  as_of_date: string;
  bills: AgingBill[];
  summary: {
    current: string;
    '31_60_days': string;
    '61_90_days': string;
    '90_plus_days': string;
    total: string;
  };
}

export interface PLItem {
  account_code: string;
  account_name: string;
  amount: string;
}

export interface ProfitLossReport {
  period: {
    start_date: string;
    end_date: string;
  };
  income: {
    items: PLItem[];
    total: string;
  };
  expenses: {
    items: PLItem[];
    total: string;
  };
  net_profit: string;
}

export interface TrialBalanceAccount {
  account_code: string;
  account_name: string;
  category: string;
  debit: string;
  credit: string;
}

export interface TrialBalanceReport {
  as_of_date: string;
  accounts: TrialBalanceAccount[];
  totals: {
    debit: string;
    credit: string;
    difference: string;
    balanced: boolean;
  };
}

export interface BalanceSheetItem {
  account_code: string;
  account_name: string;
  amount: string;
}

export interface BalanceSheetReport {
  as_of_date: string;
  assets: {
    items: BalanceSheetItem[];
    total: string;
  };
  liabilities: {
    items: BalanceSheetItem[];
    total: string;
  };
  equity: {
    items: BalanceSheetItem[];
    total: string;
  };
  totals: {
    assets: string;
    liabilities_and_equity: string;
    difference: string;
    balanced: boolean;
  };
}

// Form types for creating/updating
export interface CreateJournalLine {
  account: number;
  debit: string;
  credit: string;
  description?: string;
}

export interface CreateJournalEntry {
  entry_date: string;
  entry_type: 'manual';
  source_type: 'manual';
  description: string;
  lines: CreateJournalLine[];
}

export interface CreateBankTransaction {
  transaction_date: string;
  transaction_type: 'receipt' | 'payment' | 'transfer' | 'bank_charge' | 'interest' | 'other';
  amount: string;
  description: string;
  reference_number?: string;
}

export interface CreateChartOfAccount {
  account_code: string;
  account_name: string;
  category: number;
  parent_account?: number | null;
  allow_transactions: boolean;
  is_active: boolean;
}

export type UpdateChartOfAccount = Partial<CreateChartOfAccount>;

export interface CreateFiscalPeriod {
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'locked';
}
