'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Checkbox, Label, Spinner, TextInput } from 'flowbite-react';
import {
  HiArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineBuildingLibrary,
  HiOutlineUser,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCurrencyDollar,
} from 'react-icons/hi2';
import DashboardLayout from '@/components/DashboardLayout';
import {
  useSupplier,
  useUpdateSupplier,
  useCreateSupplierContact,
  useUpdateSupplierContact,
  useDeleteSupplierContact,
} from '@/hooks/useSuppliers';
import { getErrorMessage } from '@/utils/errorHandling';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditSupplierPage({ params }: PageProps) {
  const { id } = use(params);
  const supplierId = Number(id);
  const router = useRouter();
  const { data: supplier, isLoading, error } = useSupplier(supplierId);
  const updateSupplier = useUpdateSupplier();
  const createSupplierContact = useCreateSupplierContact();
  const updateSupplierContact = useUpdateSupplierContact();
  const deleteSupplierContact = useDeleteSupplierContact();

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
    contact_id: '',
    contact_name: '',
    contact_phone: '',
  });

  useEffect(() => {
    if (!supplier) return;
    // Find primary contact or first contact
    const primaryContact = supplier.contacts?.find((c) => c.is_primary) || supplier.contacts?.[0];
    setForm({
      supplier_code: supplier.supplier_code || '',
      name: supplier.name || '',
      company_name: supplier.company_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      mobile: supplier.mobile || '',
      address_line1: supplier.address_line1 || '',
      address_line2: supplier.address_line2 || '',
      city: supplier.city || '',
      country: supplier.country || 'Sri Lanka',
      payment_terms_days: supplier.payment_terms_days?.toString() || '30',
      credit_limit: supplier.credit_limit?.toString() || '0',
      tax_id: supplier.tax_id || '',
      is_active: supplier.is_active,
      contact_id: primaryContact?.id?.toString() || '',
      contact_name: primaryContact?.name || '',
      contact_phone: primaryContact?.phone || '',
    });
  }, [supplier]);

  const updateForm = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.supplier_code || !form.name) {
      toast.error('Supplier code and name are required.');
      return;
    }

    try {
      await updateSupplier.mutateAsync({
        id: supplierId,
        supplier_code: form.supplier_code.trim(),
        name: form.name.trim(),
        company_name: form.company_name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        mobile: form.mobile || undefined,
        address_line1: form.address_line1 || undefined,
        address_line2: form.address_line2 || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        payment_terms_days: Number(form.payment_terms_days),
        credit_limit: form.credit_limit,
        tax_id: form.tax_id || undefined,
        is_active: form.is_active,
      });

      // Handle contact person
      if (form.contact_name.trim() && form.contact_phone.trim()) {
        if (form.contact_id) {
          // Update existing contact
          await updateSupplierContact.mutateAsync({
            id: Number(form.contact_id),
            name: form.contact_name.trim(),
            phone: form.contact_phone.trim(),
            is_primary: true,
          });
        } else {
          // Create new contact
          await createSupplierContact.mutateAsync({
            supplier: supplierId,
            name: form.contact_name.trim(),
            phone: form.contact_phone.trim(),
            is_primary: true,
          });
        }
      } else if (form.contact_id) {
        // Contact info cleared - delete existing contact
        await deleteSupplierContact.mutateAsync(Number(form.contact_id));
      }

      toast.success('Supplier updated successfully!');
      router.push(`/dashboard/suppliers/${supplierId}`);
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

      let errorMessage = 'Failed to update supplier.';
      if (err.response?.data) {
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <HiOutlineBuildingLibrary className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Supplier</h1>
              </div>
            </div>
            <div className="flex items-center justify-center py-12">
              <Spinner size="xl" />
              <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
                Loading supplier...
              </span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !supplier) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center gap-4">
              <Button color="gray" size="sm" onClick={() => router.push('/dashboard/suppliers')}>
                <HiArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <HiOutlineBuildingLibrary className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Supplier</h1>
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                {error
                  ? getErrorMessage(error as unknown, 'Unable to load supplier.')
                  : 'Supplier not found.'}
              </p>
            </div>
            <div className="mt-4">
              <Button color="gray" onClick={() => router.push('/dashboard/suppliers')}>
                Back to Suppliers
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-4">
            <Button
              color="gray"
              size="sm"
              onClick={() => router.push(`/dashboard/suppliers/${supplierId}`)}
            >
              <HiArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <HiOutlineBuildingLibrary className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Supplier</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Update supplier details and contact information.
              </p>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Basic Information Card */}
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <HiOutlineUser className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Basic Information
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="supplier_code" value="Supplier Code" />
                  <TextInput
                    id="supplier_code"
                    value={form.supplier_code}
                    onChange={(e) => updateForm('supplier_code', e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="name" value="Supplier Name" />
                  <TextInput
                    id="name"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="company_name" value="Company Name" />
                  <TextInput
                    id="company_name"
                    value={form.company_name}
                    onChange={(e) => updateForm('company_name', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_id" value="Tax ID" />
                  <TextInput
                    id="tax_id"
                    value={form.tax_id}
                    onChange={(e) => updateForm('tax_id', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Card */}
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <HiOutlinePhone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Contact Information
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="email" value="Email" />
                  <TextInput
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" value="Phone" />
                  <TextInput
                    id="phone"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="mobile" value="Mobile" />
                  <TextInput
                    id="mobile"
                    value={form.mobile}
                    onChange={(e) => updateForm('mobile', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Address Card */}
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <HiOutlineMapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Address</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="address_line1" value="Address Line 1" />
                  <TextInput
                    id="address_line1"
                    value={form.address_line1}
                    onChange={(e) => updateForm('address_line1', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address_line2" value="Address Line 2" />
                  <TextInput
                    id="address_line2"
                    value={form.address_line2}
                    onChange={(e) => updateForm('address_line2', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="city" value="City" />
                  <TextInput
                    id="city"
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="country" value="Country" />
                  <TextInput
                    id="country"
                    value={form.country}
                    onChange={(e) => updateForm('country', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Payment Terms Card */}
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <HiOutlineCurrencyDollar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Payment Terms
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="payment_terms_days" value="Payment Terms (days)" />
                  <TextInput
                    id="payment_terms_days"
                    type="number"
                    value={form.payment_terms_days}
                    onChange={(e) => updateForm('payment_terms_days', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="credit_limit" value="Credit Limit" />
                  <TextInput
                    id="credit_limit"
                    type="number"
                    value={form.credit_limit}
                    onChange={(e) => updateForm('credit_limit', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <Checkbox
                      checked={form.is_active}
                      onChange={(e) => updateForm('is_active', e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>

            {/* Contact Person Card */}
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Contact Person (Optional)
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="contact_name" value="Contact Name" />
                  <TextInput
                    id="contact_name"
                    value={form.contact_name}
                    onChange={(e) => updateForm('contact_name', e.target.value)}
                    placeholder="e.g., John Smith"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone" value="Contact Phone" />
                  <TextInput
                    id="contact_phone"
                    value={form.contact_phone}
                    onChange={(e) => updateForm('contact_phone', e.target.value)}
                    placeholder="e.g., +1-234-567-8900"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Submit Section */}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" color="blue" disabled={updateSupplier.isPending}>
                {updateSupplier.isPending && <Spinner size="sm" className="mr-2" />}
                <HiOutlineCheckCircle className="mr-2 h-5 w-5" />
                Save Changes
              </Button>
              <Button
                color="gray"
                type="button"
                onClick={() => router.push(`/dashboard/suppliers/${supplierId}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
