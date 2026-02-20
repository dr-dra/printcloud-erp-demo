'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Spinner } from 'flowbite-react';
import { HiOutlineCheckCircle } from 'react-icons/hi';
import {
  HiOutlineArrowLeft,
  HiOutlineBuildingLibrary,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCurrencyDollar,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import DashboardLayout from '@/components/DashboardLayout';
import { useCreateSupplier, useCreateSupplierContact } from '@/hooks/useSuppliers';

// Auto-generate supplier code from name
const generateSupplierCode = (name: string): string => {
  if (!name.trim()) return '';

  // Common business suffixes to exclude
  const commonSuffixes = [
    'ltd',
    'inc',
    'co',
    'pvt',
    'limited',
    'corporation',
    'corp',
    'llc',
    'llp',
    'inc.',
    'co.',
    'pvt.',
    'ltd.',
    '(pvt)',
    '(pvt.)',
  ];

  let cleanedName = name.toLowerCase();

  // Remove parentheses and their contents
  cleanedName = cleanedName.replace(/\([^)]*\)/g, '');

  // Remove common suffixes
  commonSuffixes.forEach((suffix) => {
    cleanedName = cleanedName.replace(new RegExp(`\\b${suffix}\\b`, 'g'), '');
  });

  // Split into words and filter empty ones
  const words = cleanedName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return '';

  // Build code: 4 chars from first word, 2-3 from others
  let code = '';
  words.forEach((word, index) => {
    if (index === 0) {
      code += word.substring(0, 4); // First word: up to 4 chars
    } else if (index === words.length - 1) {
      code += word.substring(0, 3); // Last word: up to 3 chars
    } else {
      code += word.substring(0, 2); // Middle words: up to 2 chars
    }
  });

  return code.substring(0, 10).toUpperCase();
};

export default function NewSupplierPage() {
  const router = useRouter();
  const createSupplier = useCreateSupplier();
  const createSupplierContact = useCreateSupplierContact();
  const [form, setForm] = useState({
    supplier_code: '',
    name: '',
    company_name: '',
    email: '',
    phone: '',
    mobile: '',
    address_line1: '',
    address_line2: '',
    city: '',
    country: 'Sri Lanka',
    payment_terms_days: '30',
    credit_limit: '0',
    tax_id: '',
    is_active: true,
    contact_name: '',
    contact_phone: '',
  });

  const updateForm = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.supplier_code || !form.name) {
      alert('Supplier code and name are required.');
      return;
    }

    try {
      const supplier = await createSupplier.mutateAsync({
        supplier_code: form.supplier_code.trim(),
        name: form.name.trim(),
        company_name: form.company_name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        address_line1: form.address_line1.trim() || undefined,
        address_line2: form.address_line2.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        payment_terms_days: Number(form.payment_terms_days),
        credit_limit: form.credit_limit ? String(Number(form.credit_limit)) : '0',
        tax_id: form.tax_id.trim() || undefined,
        is_active: form.is_active,
      });

      // Create contact if contact info is provided
      if (form.contact_name.trim() && form.contact_phone.trim()) {
        await createSupplierContact.mutateAsync({
          supplier: supplier.id,
          name: form.contact_name.trim(),
          phone: form.contact_phone.trim(),
          is_primary: true,
        });
      }

      toast.success('Supplier created successfully!');
      router.push('/dashboard/suppliers');
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: {
            error?: string;
            [key: string]: any;
          };
        };
        message?: string;
      };

      // Extract detailed error message from backend
      let errorMessage = 'Failed to create supplier.';
      if (err.response?.data) {
        // Check for field-specific errors
        const errorData = err.response.data;
        if (typeof errorData === 'object') {
          const errorMessages = Object.entries(errorData)
            .map(([field, message]) => {
              if (Array.isArray(message)) {
                return `${field}: ${message.join(', ')}`;
              }
              return `${field}: ${message}`;
            })
            .join('\n');
          if (errorMessages) {
            errorMessage = errorMessages;
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      }
      toast.error(errorMessage);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard/suppliers')}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <HiOutlineArrowLeft className="h-4 w-4" />
              Back to Suppliers
            </button>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <HiOutlineBuildingLibrary className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Supplier</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add a new supplier to your system
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Basic Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="supplier_code"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Supplier Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="supplier_code"
                        type="text"
                        value={form.supplier_code}
                        onChange={(e) => updateForm('supplier_code', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="e.g., SUP001"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const generatedCode = generateSupplierCode(form.name);
                          if (generatedCode) {
                            updateForm('supplier_code', generatedCode);
                          }
                        }}
                        disabled={!form.name.trim()}
                        className="rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:disabled:bg-gray-800"
                        title="Auto-generate code from supplier name"
                      >
                        <HiOutlineSparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Supplier Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm('name', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="company_name"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Company Name
                    </label>
                    <input
                      id="company_name"
                      type="text"
                      value={form.company_name}
                      onChange={(e) => updateForm('company_name', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="tax_id"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Tax ID
                    </label>
                    <input
                      id="tax_id"
                      type="text"
                      value={form.tax_id}
                      onChange={(e) => updateForm('tax_id', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <HiOutlinePhone className="h-5 w-5 text-gray-400" />
                  Contact Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Phone
                    </label>
                    <input
                      id="phone"
                      type="text"
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mobile"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Mobile
                    </label>
                    <input
                      id="mobile"
                      type="text"
                      value={form.mobile}
                      onChange={(e) => updateForm('mobile', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <HiOutlineMapPin className="h-5 w-5 text-gray-400" />
                  Address
                </h2>
              </div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="address_line1"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Address Line 1
                    </label>
                    <input
                      id="address_line1"
                      type="text"
                      value={form.address_line1}
                      onChange={(e) => updateForm('address_line1', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="address_line2"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Address Line 2
                    </label>
                    <input
                      id="address_line2"
                      type="text"
                      value={form.address_line2}
                      onChange={(e) => updateForm('address_line2', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="city"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      City
                    </label>
                    <input
                      id="city"
                      type="text"
                      value={form.city}
                      onChange={(e) => updateForm('city', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="country"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Country
                    </label>
                    <input
                      id="country"
                      type="text"
                      value={form.country}
                      onChange={(e) => updateForm('country', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Terms & Credit Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <HiOutlineCurrencyDollar className="h-5 w-5 text-gray-400" />
                  Payment Terms
                </h2>
              </div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="payment_terms_days"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Payment Terms (days)
                    </label>
                    <input
                      id="payment_terms_days"
                      type="number"
                      value={form.payment_terms_days}
                      onChange={(e) => updateForm('payment_terms_days', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="credit_limit"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Credit Limit
                    </label>
                    <input
                      id="credit_limit"
                      type="number"
                      step="0.01"
                      value={form.credit_limit}
                      onChange={(e) => updateForm('credit_limit', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => updateForm('is_active', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 transition-colors focus:ring-2 focus:ring-primary-500"
                    />
                    <label
                      htmlFor="is_active"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Active Supplier
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Person Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Contact Person (Optional)
                </h2>
              </div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact_name"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Contact Name
                    </label>
                    <input
                      id="contact_name"
                      type="text"
                      value={form.contact_name}
                      onChange={(e) => updateForm('contact_name', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., John Smith"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact_phone"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Contact Phone
                    </label>
                    <input
                      id="contact_phone"
                      type="text"
                      value={form.contact_phone}
                      onChange={(e) => updateForm('contact_phone', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., +1-234-567-8900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Section */}
            <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => router.push('/dashboard/suppliers')}
                disabled={createSupplier.isPending}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSupplier.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createSupplier.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Creating...
                  </>
                ) : (
                  <>
                    <HiOutlineCheckCircle className="h-5 w-5" />
                    Create Supplier
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
