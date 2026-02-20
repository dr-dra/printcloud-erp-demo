"""
URL Configuration for Accounting Module

Provides REST API endpoints for:
- Chart of Accounts
- Journal Entries
- Fiscal Periods
- Bank Transactions
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountCategoryViewSet,
    ChartOfAccountsViewSet,
    AccountingAccountMappingViewSet,
    JournalEntryViewSet,
    JournalFailureViewSet,
    FiscalPeriodViewSet,
    BankTransactionViewSet,
    CashBookReportView,
    ARAgingReportView,
    APAgingReportView,
    ProfitAndLossReportView,
    TrialBalanceReportView,
    BalanceSheetReportView,
    CustomerStatementView,
    CustomerBalanceView,
    BankAccountsOnlyView,
    CashDepositView,
)

app_name = 'accounting'

# Create router and register viewsets
router = DefaultRouter()
router.register(r'account-categories', AccountCategoryViewSet, basename='accountcategory')
router.register(r'chart-of-accounts', ChartOfAccountsViewSet, basename='chartofaccounts')
router.register(r'account-mappings', AccountingAccountMappingViewSet, basename='accountmappings')
router.register(r'journal-entries', JournalEntryViewSet, basename='journalentry')
router.register(r'journal-failures', JournalFailureViewSet, basename='journalfailure')
router.register(r'fiscal-periods', FiscalPeriodViewSet, basename='fiscalperiod')
router.register(r'bank-transactions', BankTransactionViewSet, basename='banktransaction')

urlpatterns = [
    path('', include(router.urls)),

    # Financial Reports
    path('reports/cash-book/', CashBookReportView.as_view(), name='cash-book-report'),
    path('reports/ar-aging/', ARAgingReportView.as_view(), name='ar-aging-report'),
    path('reports/ap-aging/', APAgingReportView.as_view(), name='ap-aging-report'),
    path('reports/profit-loss/', ProfitAndLossReportView.as_view(), name='profit-loss-report'),
    path('reports/trial-balance/', TrialBalanceReportView.as_view(), name='trial-balance-report'),
    path('reports/balance-sheet/', BalanceSheetReportView.as_view(), name='balance-sheet-report'),

    # Customer AR Views
    path('customers/<int:customer_id>/statement/', CustomerStatementView.as_view(), name='customer-statement'),
    path('customers/<int:customer_id>/balance/', CustomerBalanceView.as_view(), name='customer-balance'),

    # Bank Accounts (for payment deposit selection)
    path('bank-accounts/', BankAccountsOnlyView.as_view(), name='bank-accounts'),
    path('cash/deposit/', CashDepositView.as_view(), name='cash-deposit'),
]
