/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  Modal,
  Button,
  Label,
  TextInput,
  Textarea,
  Select,
  Spinner,
  Datepicker,
} from 'flowbite-react';
import { HiX } from 'react-icons/hi';
import { EmailModal } from '@/components/EmailModal';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { PrintModal } from '@/components/PrintModal';
import { OrderReceiptOptionsModal } from '@/components/orders/OrderReceiptOptionsModal';
import { formatProjectDescription } from '@/utils/quotationUtils';
import type { SalesOrder, OrderPayment } from '@/types/orders';

interface OrderModalsProps {
  order: SalesOrder | null;
  orderId: string;
  emailModalOpen: boolean;
  whatsappModalOpen: boolean;
  paymentModalOpen: boolean;
  printModalState: {
    isOpen: boolean;
    documentType:
      | 'order'
      | 'quotation'
      | 'job_ticket'
      | 'invoice'
      | 'receipt'
      | 'order_receipt'
      | 'dispatch_note'
      | 'credit_note';
    documentId: string;
    documentTitle: string;
    copies: number;
  };
  paymentData: {
    amount: string;
    payment_method: string;
    payment_date: string;
    reference_number: string;
    notes: string;
    cheque_number?: string;
    cheque_date?: string;
    bank_account_id?: string;
    cheque_deposit_account?: string;
  };
  submittingPayment: boolean;
  onEmailModalClose: () => void;
  onWhatsappModalClose: () => void;
  onPaymentModalClose: () => void;
  onPrintModalClose: () => void;
  onPaymentDataChange: (data: any) => void;
  onRecordPayment: (e: React.FormEvent) => void;
  onSendComplete: (result: any) => void;
  depositAccounts?: Array<{ id: number; account_code: string; account_name: string }>;

  receiptOptionsModalOpen?: boolean;
  receiptEmailModalOpen?: boolean;
  receiptWhatsappModalOpen?: boolean;
  receiptPrintModalOpen?: boolean;
  lastRecordedPayment?: OrderPayment | null;
  onReceiptOptionsModalClose?: () => void;
  onReceiptEmailModalClose?: () => void;
  onReceiptWhatsappModalClose?: () => void;
  onReceiptPrintModalClose?: () => void;
  onReceiptEmail?: () => void;
  onReceiptWhatsApp?: () => void;
  onReceiptPrint?: () => void;
}

export function OrderModals({
  order,
  orderId,
  emailModalOpen,
  whatsappModalOpen,
  paymentModalOpen,
  printModalState,
  paymentData,
  submittingPayment,
  onEmailModalClose,
  onWhatsappModalClose,
  onPaymentModalClose,
  onPrintModalClose,
  onPaymentDataChange,
  onRecordPayment,
  onSendComplete,
  depositAccounts = [],
  receiptOptionsModalOpen = false,
  receiptEmailModalOpen = false,
  receiptWhatsappModalOpen = false,
  receiptPrintModalOpen = false,
  lastRecordedPayment = null,
  onReceiptOptionsModalClose = () => {},
  onReceiptEmailModalClose = () => {},
  onReceiptWhatsappModalClose = () => {},
  onReceiptPrintModalClose = () => {},
  onReceiptEmail = () => {},
  onReceiptWhatsApp = () => {},
  onReceiptPrint = () => {},
}: OrderModalsProps) {
  const balanceDueValue = order ? Number(order.balance_due || 0) : 0;
  const paymentAmountValue = parseFloat(paymentData.amount || '0');
  const hasValidAmount = Number.isFinite(paymentAmountValue);
  const overpaymentAmount =
    hasValidAmount && paymentAmountValue > balanceDueValue
      ? paymentAmountValue - balanceDueValue
      : 0;
  const displayBalanceDue = overpaymentAmount > 0 ? 0 : balanceDueValue;
  const projectDescription = order
    ? order.project_name ||
      formatProjectDescription((order.items || []).map((item) => ({ item: item.item_name })))
    : '';

  return (
    <>
      {order && (
        <EmailModal
          isOpen={emailModalOpen}
          onClose={onEmailModalClose}
          documentId={orderId}
          documentType="order"
          document={{
            id: order.id,
            order_number: order.order_number,
            costing_name: order.costing_name,
            customer: order.customer
              ? {
                  id: order.customer.id,
                  name: order.customer.name,
                  email: order.customer.email,
                }
              : undefined,
            items: order.items?.map((item) => ({
              item: item.item_name,
              description: item.description,
              costing_sheet_name: item.costing_sheet_name,
            })),
          }}
          onSendComplete={onSendComplete}
        />
      )}

      {order && (
        <WhatsAppModal
          isOpen={whatsappModalOpen}
          onClose={onWhatsappModalClose}
          documentId={orderId}
          documentType="order"
          document={{
            id: order.id,
            order_number: order.order_number,
            costing_name: order.costing_name,
            customer: order.customer
              ? {
                  name: order.customer.name,
                  phone: order.customer.contact,
                }
              : undefined,
            items: order.items?.map((item) => ({
              item: item.item_name,
              description: item.description,
              costing_sheet_name: item.costing_sheet_name,
            })),
          }}
          onSendComplete={onSendComplete}
        />
      )}

      <Modal show={paymentModalOpen} onClose={onPaymentModalClose} size="5xl">
        <form onSubmit={onRecordPayment}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Record Payment
                  </h3>
                  {order && (
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Order: </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          #{order.order_number}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          {order.customer?.name}
                        </span>
                      </div>
                      <div className="text-sm border-l border-gray-300 dark:border-gray-600 pl-4">
                        <span className="text-gray-500 dark:text-gray-400">Balance: </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          Rs. {displayBalanceDue.toLocaleString()}
                        </span>
                        {overpaymentAmount > 0 && (
                          <span className="ml-2 text-red-600 dark:text-red-400 font-semibold">
                            (Overpayment: Rs. {overpaymentAmount.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onPaymentModalClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {order && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Payment Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                      <div>
                        <Label htmlFor="method" className="text-sm font-medium">
                          Payment Method <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          id="method"
                          required
                          value={paymentData.payment_method}
                          onChange={(e) => {
                            onPaymentDataChange({
                              ...paymentData,
                              payment_method: e.target.value,
                              reference_number: '',
                              cheque_number: '',
                              cheque_date: '',
                              cheque_deposit_account: '',
                              bank_account_id: '',
                            });
                          }}
                          className="mt-1"
                        >
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="card">Card</option>
                          <option value="other">Other</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="amount" className="text-sm font-medium">
                          Amount (Rs.) <span className="text-red-500">*</span>
                        </Label>
                        <TextInput
                          id="amount"
                          type="number"
                          step="0.01"
                          required
                          value={paymentData.amount}
                          onChange={(e) =>
                            onPaymentDataChange({ ...paymentData, amount: e.target.value })
                          }
                          placeholder={`Max: Rs. ${order.balance_due || 0}`}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {(paymentData.payment_method === 'bank_transfer' ||
                    paymentData.payment_method === 'card') && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        {paymentData.payment_method === 'card'
                          ? 'Card Payment Details'
                          : 'Bank Transfer Details'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <Label htmlFor="bank_account" className="text-sm font-medium">
                            Received Into (Bank) <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            id="bank_account"
                            required
                            value={paymentData.bank_account_id || ''}
                            onChange={(e) =>
                              onPaymentDataChange({
                                ...paymentData,
                                bank_account_id: e.target.value,
                              })
                            }
                            className="mt-1"
                          >
                            <option value="">-- Select Bank Account --</option>
                            {depositAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.account_code} - {account.account_name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="ref" className="text-sm font-medium">
                            Reference Number <span className="text-red-500">*</span>
                          </Label>
                          <TextInput
                            id="ref"
                            required
                            value={paymentData.reference_number}
                            onChange={(e) =>
                              onPaymentDataChange({
                                ...paymentData,
                                reference_number: e.target.value,
                              })
                            }
                            placeholder={
                              paymentData.payment_method === 'card'
                                ? 'e.g. Card Auth Code'
                                : 'e.g. Transaction Reference #'
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentData.payment_method === 'cheque' && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Cheque Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <Label htmlFor="bank_account_cheque" className="text-sm font-medium">
                            Deposit To (Bank) <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            id="bank_account_cheque"
                            required
                            value={paymentData.cheque_deposit_account || ''}
                            onChange={(e) =>
                              onPaymentDataChange({
                                ...paymentData,
                                cheque_deposit_account: e.target.value,
                              })
                            }
                            className="mt-1"
                          >
                            <option value="">-- Select Bank Account --</option>
                            {depositAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.account_code} - {account.account_name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="cheque_number" className="text-sm font-medium">
                            Cheque Number <span className="text-red-500">*</span>
                          </Label>
                          <TextInput
                            id="cheque_number"
                            required
                            value={paymentData.cheque_number || ''}
                            onChange={(e) =>
                              onPaymentDataChange({
                                ...paymentData,
                                cheque_number: e.target.value,
                              })
                            }
                            placeholder="e.g. CHQ-12345"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cheque_date" className="text-sm font-medium">
                            Cheque Date (Optional)
                          </Label>
                          <Datepicker
                            value={paymentData.cheque_date || ''}
                            onSelectedDateChanged={(date: Date | null) =>
                              onPaymentDataChange({
                                ...paymentData,
                                cheque_date: date ? date.toISOString().split('T')[0] : '',
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentData.payment_method !== 'cash' && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                      <div>
                        <Label htmlFor="notes" className="text-sm font-medium">
                          Additional Notes (Optional)
                        </Label>
                        <Textarea
                          id="notes"
                          value={paymentData.notes}
                          onChange={(e) =>
                            onPaymentDataChange({
                              ...paymentData,
                              notes: e.target.value,
                            })
                          }
                          rows={2}
                          placeholder="Add any additional notes about this payment..."
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex justify-end gap-3">
                <Button color="gray" onClick={onPaymentModalClose} size="md">
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingPayment} color="success" size="md">
                  {submittingPayment ? <Spinner size="sm" /> : 'Record Payment'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <PrintModal
        isOpen={printModalState.isOpen}
        onClose={onPrintModalClose}
        documentType={printModalState.documentType}
        documentId={printModalState.documentId}
        documentTitle={printModalState.documentTitle}
        copies={printModalState.copies}
        onSendComplete={onSendComplete}
      />

      {lastRecordedPayment && order && (
        <OrderReceiptOptionsModal
          isOpen={receiptOptionsModalOpen}
          onClose={onReceiptOptionsModalClose}
          payment={lastRecordedPayment}
          order={{
            id: order.id,
            order_number: order.order_number,
            project_name: projectDescription || undefined,
            customer: order.customer,
            customer_name: order.customer?.name,
            customer_address: order.customer?.address,
            customer_phone: order.customer?.contact,
            balance_due: order.balance_due,
            amount_paid: order.amount_paid,
          }}
          cashierName={lastRecordedPayment?.created_by_name || 'Staff'}
          onEmailClick={onReceiptEmail}
          onWhatsAppClick={onReceiptWhatsApp}
          onPrintClick={onReceiptPrint}
        />
      )}

      {lastRecordedPayment && order && (
        <EmailModal
          isOpen={receiptEmailModalOpen}
          onClose={onReceiptEmailModalClose}
          documentId={String(lastRecordedPayment.id)}
          documentType="order_receipt"
          document={{
            id: lastRecordedPayment.id,
            receipt_number: lastRecordedPayment.receipt_number,
            order_number: order.order_number,
            customer: order.customer
              ? {
                  name: order.customer.name,
                  email: order.customer.email,
                }
              : undefined,
          }}
          onSendComplete={onSendComplete}
        />
      )}

      {lastRecordedPayment && order && (
        <WhatsAppModal
          isOpen={receiptWhatsappModalOpen}
          onClose={onReceiptWhatsappModalClose}
          documentId={String(lastRecordedPayment.id)}
          documentType="order_receipt"
          document={{
            id: lastRecordedPayment.id,
            receipt_number: lastRecordedPayment.receipt_number,
            order_number: order.order_number,
            customer: order.customer
              ? {
                  name: order.customer.name,
                  phone: order.customer.contact,
                }
              : undefined,
          }}
          onSendComplete={onSendComplete}
        />
      )}

      {lastRecordedPayment && (
        <PrintModal
          isOpen={receiptPrintModalOpen}
          onClose={onReceiptPrintModalClose}
          documentType="order_receipt"
          documentId={String(lastRecordedPayment.id)}
          documentTitle={`Receipt #${lastRecordedPayment.receipt_number}`}
          copies={1}
          onSendComplete={onSendComplete}
        />
      )}
    </>
  );
}
