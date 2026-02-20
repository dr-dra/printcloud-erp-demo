'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Card, Spinner } from 'flowbite-react';
import { ArrowLeft, Edit3, Trash2, Download, FileText, User, Building } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import ArchiveCustomerAlert from '@/components/common/ArchiveCustomerAlert';
import { toast } from 'sonner';

// Types for customer data
interface CustomerAddress {
  type: 'billing' | 'shipping';
  line1: string;
  line2?: string;
  city: string;
  zip_code?: string;
  province?: string;
  country?: string;
  phone?: string;
  delivery_instructions?: string;
}

interface CustomerDocument {
  id: number;
  file: string;
  title: string;
  description?: string;
  uploaded_at: string;
}

interface Customer {
  id: number;
  name: string;
  customer_type: 'individual' | 'business';
  email?: string;
  contact?: string;
  account_no?: string;
  website?: string;
  fax?: string;
  credit_limit?: number;
  due_on_days?: number;
  payment_term?: number;
  is_active: boolean;
  addresses: CustomerAddress[];
  documents: CustomerDocument[];
  advance_summary?: {
    available_balance: number | string;
    total_amount: number | string;
  };
  total_spend_lifetime?: number | string;
  total_spend_12m?: number | string;
  recent_orders?: Array<{
    id: number;
    order_number: string;
    order_date: string;
    status: string;
    net_total: number | string;
  }>;
}

interface CustomerAdvance {
  id: number;
  advance_date: string;
  amount: number | string;
  balance: number | string;
  status: string;
  source_type: string;
  notes?: string;
}

export default function CustomerViewPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showArchiveAlert, setShowArchiveAlert] = useState(false);
  const [advances, setAdvances] = useState<CustomerAdvance[]>([]);
  const [advancesLoading, setAdvancesLoading] = useState(false);

  // Fetch customer data
  const fetchCustomer = async () => {
    if (!isAuthenticated || !customerId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get<Customer>(`/customers/${customerId}/`);
      setCustomer(response.data);
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('Error fetching customer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [isAuthenticated, customerId]);

  useEffect(() => {
    const fetchAdvances = async () => {
      if (!isAuthenticated || !customerId) return;
      try {
        setAdvancesLoading(true);
        const response = await api.get(`/customers/${customerId}/advances/`, {
          params: { page_size: 5 },
        });
        const results = response.data?.results ?? response.data ?? [];
        setAdvances(results);
      } catch (err) {
        console.error('Error fetching customer advances:', err);
      } finally {
        setAdvancesLoading(false);
      }
    };

    fetchAdvances();
  }, [isAuthenticated, customerId]);

  const handleBack = () => {
    router.push('/dashboard/sales/customers');
  };

  const handleEdit = () => {
    router.push(`/dashboard/sales/customers/${customerId}/edit`);
  };

  const handleDelete = () => {
    setShowArchiveAlert(true);
  };

  const handleArchiveConfirm = async () => {
    try {
      setDeleteLoading(true);

      // Use archive endpoint instead of delete
      await api.post(`/customers/${customerId}/archive/`, {
        reason: 'Archived via customer view',
      });

      toast.success('Customer archived successfully');
      setShowArchiveAlert(false);
      router.push('/dashboard/sales/customers');
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);

      // Handle business logic errors gracefully
      if (errorMessage.includes('active orders') || errorMessage.includes('pending invoices')) {
        toast.error(`Cannot archive customer: ${errorMessage}`);
      } else {
        toast.error(`Failed to archive customer: ${errorMessage}`);
      }

      console.error('Error archiving customer:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchiveCancel = () => {
    setShowArchiveAlert(false);
  };

  const handleDownloadDocument = (document: CustomerDocument) => {
    // Open the file URL in a new tab for download
    window.open(document.file, '_blank');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | string) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <ErrorBanner
            title="Unable to load customer"
            error={error}
            onRetry={fetchCustomer}
            onDismiss={() => setError(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Customer not found</p>
            <Button onClick={handleBack} className="mt-4">
              Back to Customers
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                color="gray"
                size="sm"
                onClick={handleBack}
                className="gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 w-fit"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {customer.name}
                  </h1>
                  <span
                    className={`${customer.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'} text-xs font-medium px-2.5 py-0.5 rounded`}
                  >
                    {customer.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span
                    className={`${customer.customer_type === 'business' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'} text-xs font-medium px-2.5 py-0.5 rounded`}
                  >
                    {customer.customer_type === 'business' ? (
                      <>
                        <Building className="w-3 h-3 mr-1 inline" /> Business
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 mr-1 inline" /> Individual
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Customer ID: {customer.id}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleEdit}
                className="gap-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
              >
                <Edit3 className="h-4 w-4" />
                Edit Customer
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="gap-2 bg-gray-600 hover:bg-gray-700 focus:ring-gray-300 text-white border-gray-600 hover:border-gray-700 focus:ring-4 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800"
              >
                <Trash2 className="h-4 w-4" />
                {deleteLoading ? 'Archiving...' : 'Archive'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Contact Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">
                      Customer Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                      {customer.name}
                    </p>
                  </div>

                  {customer.email && (
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400">
                        Email
                      </label>
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {customer.email}
                      </a>
                    </div>
                  )}
                </div>

                {customer.contact && (
                  <div className="mt-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Phone Contacts
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          Contact Name
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">Primary Contact</p>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          Contact Number
                        </label>
                        <a
                          href={`tel:${customer.contact}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {customer.contact}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {customer.addresses && customer.addresses.length > 0 && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="p-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                    Address Information
                  </h2>

                  {customer.addresses.map((address, index) => (
                    <div key={index} className="mb-4 last:mb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                          {address.type === 'billing' ? 'Billing Address' : 'Shipping Address'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs text-gray-500 dark:text-gray-400">
                            Address Line 1
                          </label>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {address.line1 || 'Not provided'}
                          </p>
                        </div>

                        {address.line2 && (
                          <div className="space-y-1 md:col-span-2">
                            <label className="block text-xs text-gray-500 dark:text-gray-400">
                              Address Line 2
                            </label>
                            <p className="text-sm text-gray-900 dark:text-white">{address.line2}</p>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400">
                            City
                          </label>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {address.city || 'Not provided'}
                          </p>
                        </div>

                        {address.zip_code && (
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-500 dark:text-gray-400">
                              Postal Code
                            </label>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {address.zip_code}
                            </p>
                          </div>
                        )}

                        {address.province && (
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-500 dark:text-gray-400">
                              Province
                            </label>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {address.province}
                            </p>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400">
                            Country
                          </label>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {address.country || 'Sri Lanka'}
                          </p>
                        </div>
                      </div>

                      {address.delivery_instructions && (
                        <div className="mt-3 space-y-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400">
                            Delivery Instructions
                          </label>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {address.delivery_instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Account Summary
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Paid (Lifetime)</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(customer.total_spend_lifetime || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Paid (12 Months)</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(customer.total_spend_12m || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Advance Balance</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(customer.advance_summary?.available_balance || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total Advances</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(customer.advance_summary?.total_amount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Orders
                </h2>

                {customer.recent_orders && customer.recent_orders.length > 0 ? (
                  <div className="space-y-3">
                    {customer.recent_orders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            #{order.order_number}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(order.order_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{order.status}</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {formatCurrency(order.net_total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent orders.</p>
                )}
              </div>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  More Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.account_no && (
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400">
                        Account Number
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">{customer.account_no}</p>
                    </div>
                  )}

                  {customer.website && (
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400">
                        Website
                      </label>
                      <a
                        href={customer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {customer.website}
                      </a>
                    </div>
                  )}

                  {customer.fax && (
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Fax</label>
                      <p className="text-sm text-gray-900 dark:text-white">{customer.fax}</p>
                    </div>
                  )}
                </div>

                {!customer.account_no && !customer.website && !customer.fax && (
                  <div className="text-center py-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No additional information available
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {customer.documents && customer.documents.length > 0 && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="p-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                    Files ({customer.documents.length})
                  </h2>

                  <div className="space-y-3">
                    {customer.documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-7 w-7 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {document.title}
                            </h3>
                            {document.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {document.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Uploaded {formatDate(document.uploaded_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleDownloadDocument(document)}
                          className="gap-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="w-full xl:w-80 flex-shrink-0 space-y-4">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Payment Terms
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">
                      Payment Type
                    </label>
                    <span
                      className={`${customer.credit_limit ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'} text-xs font-medium px-2.5 py-0.5 rounded`}
                    >
                      {customer.credit_limit ? 'Credit' : 'Cash'}
                    </span>
                  </div>

                  {customer.credit_limit && (
                    <div className="grid grid-cols-1 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {customer.payment_term && (
                        <div className="space-y-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400">
                            Credit Period (Days)
                          </label>
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {customer.payment_term} Days
                          </p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                          Credit Limit (Rs.)
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                          {formatCurrency(customer.credit_limit)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Customer Advances
                </h2>

                {advancesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Spinner size="sm" />
                    Loading advances...
                  </div>
                ) : advances.length > 0 ? (
                  <div className="space-y-3">
                    {advances.map((advance) => (
                      <div
                        key={advance.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {advance.source_type === 'overpayment' ? 'Overpayment' : 'Prepayment'}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(advance.advance_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{advance.status}</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {formatCurrency(advance.balance)} / {formatCurrency(advance.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No advances recorded.</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        <ArchiveCustomerAlert
          show={showArchiveAlert}
          customerName={customer?.name || ''}
          loading={deleteLoading}
          onConfirm={handleArchiveConfirm}
          onCancel={handleArchiveCancel}
        />
      </div>
    </DashboardLayout>
  );
}
