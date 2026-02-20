'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api, accountingAPI } from '@/lib/api';
import { Button, TextInput, Label, Select, Textarea, Badge } from 'flowbite-react';

const REASON_OPTIONS = [
  { value: 'bounced_cheque', label: 'Bounced Cheque' },
  { value: 'overpayment', label: 'Overpayment' },
  { value: 'less_quantity', label: 'Less Quantity' },
  { value: 'canceled_item', label: 'Canceled Item' },
  { value: 'customer_change', label: 'Customer Change' },
  { value: 'price_correction', label: 'Price Correction' },
  { value: 'service_not_delivered', label: 'Service not delivered' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_ACTIONS = [
  { value: 'payment_reverse', label: 'Reverse Payment' },
  { value: 'payment_refund', label: 'Refund Payment' },
];

const PAYOUT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

type CustomerOption = {
  id: number;
  name: string;
  email?: string;
  contact?: string;
  bank_account_name?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
};

type InvoiceOption = {
  id: number;
  invoice_number: string;
  status: string;
  balance_due: string | number;
};

type OrderOption = {
  id: number;
  order_number: string;
  status: string;
  balance_due: string | number;
};

type PaymentOption = {
  id: number;
  payment_date: string;
  amount: string | number;
  payment_method: string;
  reference_number?: string;
  cheque_cleared?: boolean;
  is_void?: boolean;
  is_reversed?: boolean;
  is_refunded?: boolean;
};

type ReceiptLookup = {
  payment: PaymentOption;
  invoice?: { id: number; invoice_number: string; customer_name: string };
  order?: { id: number; order_number: string; customer_name: string };
  document_type?: 'order';
};

export default function NewCreditNotePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptLookup, setReceiptLookup] = useState<ReceiptLookup | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  const [targetType, setTargetType] = useState<'invoice' | 'order'>('invoice');
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOption | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentOption | null>(null);

  const [actionType, setActionType] = useState<'payment_reverse' | 'payment_refund'>(
    'payment_refund',
  );
  const [reason, setReason] = useState(REASON_OPTIONS[0].value);
  const [detailNote, setDetailNote] = useState('');

  const [payoutMethod, setPayoutMethod] = useState('cash');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutVoucherNumber, setPayoutVoucherNumber] = useState('');
  const [payoutChequeNumber, setPayoutChequeNumber] = useState('');
  const [customerBankName, setCustomerBankName] = useState('');
  const [customerBankAccountName, setCustomerBankAccountName] = useState('');
  const [customerBankAccountNumber, setCustomerBankAccountNumber] = useState('');

  const [accounts, setAccounts] = useState<
    Array<{ id: number; account_code: string; account_name: string }>
  >([]);
  const [creating, setCreating] = useState(false);

  const payoutAccounts = useMemo(
    () =>
      accounts.filter((acc) => acc.account_code.startsWith('10') && acc.account_code !== '1040'),
    [accounts],
  );

  const allowedReasons = useMemo(() => {
    if (!selectedPayment) return REASON_OPTIONS;
    if (selectedPayment.payment_method !== 'cheque') {
      return REASON_OPTIONS.filter((opt) => opt.value !== 'bounced_cheque');
    }
    return REASON_OPTIONS;
  }, [selectedPayment]);

  useEffect(() => {
    if (!allowedReasons.find((opt) => opt.value === reason)) {
      setReason(allowedReasons[0]?.value || 'other');
    }
  }, [allowedReasons, reason]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const resp = await accountingAPI.getChartOfAccounts({ allow_transactions: true });
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        setAccounts(list);
      } catch {
        setAccounts([]);
      }
    };
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerResults([]);
      return;
    }

    const fetchCustomers = async () => {
      try {
        const resp = await api.get('/customers/', { params: { search: customerQuery } });
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        setCustomerResults(list);
      } catch {
        setCustomerResults([]);
      }
    };

    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  useEffect(() => {
    const fetchDocs = async () => {
      if (!selectedCustomer) return;
      try {
        const [invoiceResp, orderResp] = await Promise.all([
          api.get('/sales/invoices/', { params: { customer: selectedCustomer.id } }),
          api.get('/sales/orders/', { params: { customer: selectedCustomer.id } }),
        ]);
        const invoiceList = Array.isArray(invoiceResp.data)
          ? invoiceResp.data
          : invoiceResp.data?.results || [];
        const orderList = Array.isArray(orderResp.data)
          ? orderResp.data
          : orderResp.data?.results || [];
        setInvoiceOptions(invoiceList);
        setOrderOptions(orderList);
      } catch {
        setInvoiceOptions([]);
        setOrderOptions([]);
      }
    };
    fetchDocs();
  }, [selectedCustomer]);

  useEffect(() => {
    const fetchPayments = async () => {
      setPaymentOptions([]);
      setSelectedPayment(null);
      try {
        if (targetType === 'invoice' && selectedInvoice) {
          const resp = await api.get(`/sales/invoices/${selectedInvoice.id}/`);
          const payments = resp.data?.payments || [];
          setPaymentOptions(
            payments.filter((p: PaymentOption) => !p.is_void && !p.is_reversed && !p.is_refunded),
          );
        }
        if (targetType === 'order' && selectedOrder) {
          const resp = await api.get(`/sales/orders/${selectedOrder.id}/`);
          const payments = resp.data?.payments || [];
          setPaymentOptions(
            payments.filter((p: PaymentOption) => !p.is_void && !p.is_reversed && !p.is_refunded),
          );
        }
      } catch {
        setPaymentOptions([]);
      }
    };

    fetchPayments();
  }, [targetType, selectedInvoice, selectedOrder]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerBankAccountName(selectedCustomer.bank_account_name || '');
    setCustomerBankName(selectedCustomer.bank_name || '');
    setCustomerBankAccountNumber(selectedCustomer.bank_account_number || '');
  }, [selectedCustomer]);

  const lookupReceipt = async () => {
    if (!receiptNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const invoiceResp = await api.get(`/sales/invoices/receipts/${receiptNumber}/`);
      const receiptData = invoiceResp.data;
      setReceiptLookup(receiptData);
      if (receiptData.invoice) {
        setTargetType('invoice');
        setSelectedInvoice({
          id: receiptData.invoice.id,
          invoice_number: receiptData.invoice.invoice_number,
          status: 'sent',
          balance_due: '',
        });
      }
      setSelectedPayment({
        ...receiptData.payment,
        is_void: false,
        is_reversed: false,
        is_refunded: false,
      });
    } catch {
      try {
        const orderResp = await api.get(`/sales/orders/receipts/${receiptNumber}/`);
        const receiptData = orderResp.data;
        setReceiptLookup(receiptData);
        setTargetType('order');
        if (receiptData.order) {
          setSelectedOrder({
            id: receiptData.order.id,
            order_number: receiptData.order.order_number,
            status: 'confirmed',
            balance_due: '',
          });
        }
        setSelectedPayment({
          ...receiptData.payment,
          is_void: false,
          is_reversed: false,
          is_refunded: false,
        });
      } catch {
        setError('Receipt not found.');
        setReceiptLookup(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPayment) {
      setError('Please select a payment.');
      return;
    }
    if (!detailNote.trim()) {
      setError('Detail note is required.');
      return;
    }
    if (actionType === 'payment_refund') {
      if (!payoutMethod) {
        setError('Payout method is required.');
        return;
      }
      if (!payoutAccount) {
        setError('Payout account is required.');
        return;
      }
      if (['cash', 'cheque'].includes(payoutMethod) && !payoutVoucherNumber.trim()) {
        setError('Voucher number is required for cash/cheque refunds.');
        return;
      }
      if (payoutMethod === 'cheque' && !payoutChequeNumber.trim()) {
        setError('Cheque number is required for cheque refunds.');
        return;
      }
      if (payoutMethod === 'bank_transfer') {
        if (!customerBankAccountName || !customerBankName || !customerBankAccountNumber) {
          setError('Customer bank details are required for bank transfer refunds.');
          return;
        }
      }
    }

    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        credit_note_type: actionType,
        customer: selectedCustomer?.id,
        reason,
        detail_note: detailNote,
        payout_method: actionType === 'payment_refund' ? payoutMethod : null,
        payout_account: actionType === 'payment_refund' ? payoutAccount : null,
        payout_voucher_number: actionType === 'payment_refund' ? payoutVoucherNumber : null,
        payout_cheque_number: actionType === 'payment_refund' ? payoutChequeNumber : null,
        customer_bank_account_name:
          actionType === 'payment_refund' ? customerBankAccountName : null,
        customer_bank_name: actionType === 'payment_refund' ? customerBankName : null,
        customer_bank_account_number:
          actionType === 'payment_refund' ? customerBankAccountNumber : null,
      };

      if (targetType === 'invoice') {
        payload.invoice = selectedInvoice?.id || null;
        payload.invoice_payment = selectedPayment.id;
      } else {
        payload.order = selectedOrder?.id || null;
        payload.order_payment = selectedPayment.id;
      }

      await api.post('/sales/invoices/credit-notes/', payload);
      window.location.href = '/dashboard/accounting/credit-notes';
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setError(message || 'Failed to create credit note.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Credit Note</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create a credit note for reversals or refunds. All actions are recorded in Accounting.
            </p>
          </div>
          <Button
            color="gray"
            onClick={() => (window.location.href = '/dashboard/accounting/credit-notes')}
          >
            Back to Credit Notes
          </Button>
        </div>

        {error && <div className="mb-4 text-red-600">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Find Payment
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label value="Receipt Number" />
                  <div className="flex gap-2">
                    <TextInput
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                    />
                    <Button color="gray" onClick={lookupReceipt} isProcessing={loading}>
                      Lookup
                    </Button>
                  </div>
                </div>
                <div>
                  <Label value="Customer" />
                  <TextInput
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Search customer"
                  />
                  {customerResults.length > 0 && !selectedCustomer && (
                    <div className="border rounded-md max-h-40 overflow-y-auto bg-white">
                      {customerResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerQuery(customer.name);
                            setCustomerResults([]);
                          }}
                        >
                          {customer.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {receiptLookup && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Receipt Found</span>
                    <Badge color="success">
                      {receiptLookup.document_type === 'order' ? 'Order' : 'Invoice'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Payment: Rs. {receiptLookup.payment.amount} (
                    {receiptLookup.payment.payment_method})
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Select Document & Payment
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label value="Target" />
                  <Select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as 'invoice' | 'order')}
                  >
                    <option value="invoice">Invoice</option>
                    <option value="order">Order</option>
                  </Select>
                </div>
                <div>
                  {targetType === 'invoice' ? (
                    <>
                      <Label value="Invoice" />
                      <Select
                        value={selectedInvoice?.id || ''}
                        onChange={(e) => {
                          const selected = invoiceOptions.find(
                            (inv) => String(inv.id) === e.target.value,
                          );
                          setSelectedInvoice(selected || null);
                        }}
                      >
                        <option value="">Select invoice</option>
                        {invoiceOptions.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoice_number} (Balance: {inv.balance_due})
                          </option>
                        ))}
                      </Select>
                    </>
                  ) : (
                    <>
                      <Label value="Order" />
                      <Select
                        value={selectedOrder?.id || ''}
                        onChange={(e) => {
                          const selected = orderOptions.find(
                            (ord) => String(ord.id) === e.target.value,
                          );
                          setSelectedOrder(selected || null);
                        }}
                      >
                        <option value="">Select order</option>
                        {orderOptions.map((ord) => (
                          <option key={ord.id} value={ord.id}>
                            {ord.order_number} (Balance: {ord.balance_due})
                          </option>
                        ))}
                      </Select>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Label value="Payment" />
                <Select
                  value={selectedPayment?.id || ''}
                  onChange={(e) => {
                    const selected = paymentOptions.find(
                      (pay) => String(pay.id) === e.target.value,
                    );
                    setSelectedPayment(selected || null);
                  }}
                >
                  <option value="">Select payment</option>
                  {paymentOptions.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      {payment.payment_method} - Rs. {payment.amount}
                    </option>
                  ))}
                </Select>
              </div>

              {selectedPayment && (
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Payment method: {selectedPayment.payment_method}
                  {selectedPayment.payment_method === 'cheque' && (
                    <span> (cleared: {selectedPayment.cheque_cleared ? 'yes' : 'no'})</span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Reason & Action
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label value="Action" />
                  <Select
                    value={actionType}
                    onChange={(e) =>
                      setActionType(e.target.value as 'payment_reverse' | 'payment_refund')
                    }
                  >
                    {PAYMENT_ACTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label value="Reason" />
                  <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                    {allowedReasons.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label value="Detail Note (required)" />
                <Textarea
                  value={detailNote}
                  rows={4}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Explain the reason..."
                />
              </div>
            </div>

            {actionType === 'payment_refund' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Refund Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label value="Payout Method" />
                    <Select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
                      {PAYOUT_METHODS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label value="Payout Account" />
                    <Select
                      value={payoutAccount}
                      onChange={(e) => setPayoutAccount(e.target.value)}
                    >
                      <option value="">Select account</option>
                      {payoutAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_code} - {acc.account_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label value="Voucher Number" />
                    <TextInput
                      value={payoutVoucherNumber}
                      onChange={(e) => setPayoutVoucherNumber(e.target.value)}
                      placeholder="Voucher #"
                    />
                  </div>
                  {payoutMethod === 'cheque' && (
                    <div>
                      <Label value="Cheque Number" />
                      <TextInput
                        value={payoutChequeNumber}
                        onChange={(e) => setPayoutChequeNumber(e.target.value)}
                        placeholder="Cheque #"
                      />
                    </div>
                  )}
                </div>

                {payoutMethod === 'bank_transfer' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label value="Customer Bank Name" />
                      <TextInput
                        value={customerBankName}
                        onChange={(e) => setCustomerBankName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label value="Customer Account Name" />
                      <TextInput
                        value={customerBankAccountName}
                        onChange={(e) => setCustomerBankAccountName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label value="Customer Account Number" />
                      <TextInput
                        value={customerBankAccountNumber}
                        onChange={(e) => setCustomerBankAccountNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Summary</h2>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div>
                  <strong>Customer:</strong> {selectedCustomer?.name || 'Not selected'}
                </div>
                <div>
                  <strong>Target:</strong>{' '}
                  {targetType === 'invoice'
                    ? selectedInvoice?.invoice_number || '-'
                    : selectedOrder?.order_number || '-'}
                </div>
                <div>
                  <strong>Payment:</strong>{' '}
                  {selectedPayment ? `Rs. ${selectedPayment.amount}` : '-'}
                </div>
                <div>
                  <strong>Action:</strong> {actionType.replace('_', ' ')}
                </div>
                <div>
                  <strong>Reason:</strong> {reason.replace('_', ' ')}
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={handleCreate} isProcessing={creating}>
                Create Credit Note
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
