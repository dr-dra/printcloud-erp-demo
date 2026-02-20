'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Card, Label, Checkbox, Radio, Spinner } from 'flowbite-react';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import ErrorBanner from '@/components/common/ErrorBanner';

interface ContactInfo {
  id: number;
  person: string;
  number: string;
  isPrimary: boolean;
}

interface DocumentInfo {
  id: number;
  file: File | null;
  title: string;
  description: string;
}

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

interface ExistingDocument {
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
  documents: ExistingDocument[];
}

// Countries list for autocomplete
const COUNTRIES = [
  'Sri Lanka',
  'Maldives',
  'India',
  'Pakistan',
  'Bangladesh',
  'Nepal',
  'Bhutan',
  'Afghanistan',
  'Singapore',
  'Malaysia',
  'Thailand',
  'Indonesia',
  'Philippines',
  'Vietnam',
  'Myanmar',
  'Cambodia',
  'Laos',
  'Brunei',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'Jordan',
  'Lebanon',
  'Iraq',
  'Iran',
  'Israel',
  'Turkey',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'New Zealand',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Norway',
  'Sweden',
  'Denmark',
  'Finland',
  'Japan',
  'South Korea',
  'China',
  'Russia',
  'Brazil',
  'Mexico',
  'Argentina',
  'South Africa',
  'Egypt',
  'Nigeria',
  'Kenya',
  'Morocco',
];

// Sri Lankan Banks list for autocomplete
const BANKS = [
  'Amana Bank PLC',
  'Bank of Ceylon',
  'Bank of China Ltd',
  'Cargills Bank PLC',
  'Citibank, N.A.',
  'Commercial Bank of Ceylon PLC',
  'Deutsche Bank AG',
  'DFCC Bank PLC',
  'Habib Bank Ltd',
  'Hatton National Bank PLC',
  'Indian Bank',
  'Indian Overseas Bank',
  'MCB Bank Ltd',
  'National Development Bank PLC',
  'Nations Trust Bank PLC',
  'Pan Asia Banking Corporation PLC',
  "People's Bank",
  'Public Bank Berhad',
  'Sampath Bank PLC',
  'Seylan Bank PLC',
  'Standard Chartered Bank',
  'State Bank of India',
  'The Hongkong & Shanghai Banking Corporation Ltd (HSBC)',
  'Union Bank of Colombo PLC',
];

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer data
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<'individual' | 'business'>('business');
  const [email, setEmail] = useState('');
  const [phoneContacts, setPhoneContacts] = useState<ContactInfo[]>([
    { id: 1, person: '', number: '', isPrimary: true },
  ]);
  const [addressLine, setAddressLine] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [countrySearch, setCountrySearch] = useState('Sri Lanka');
  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [paymentTerm, setPaymentTerm] = useState('cash');
  const [creditPeriod, setCreditPeriod] = useState('30');
  const [creditLimit, setCreditLimit] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bank, setBank] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [filteredBanks, setFilteredBanks] = useState<string[]>([]);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [website, setWebsite] = useState('');
  const [fax, setFax] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Document upload states
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);

  // Validation states
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Fetch customer data
  const fetchCustomer = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<Customer>(`/customers/${customerId}/`);
      const customerData = response.data;

      setCustomer(customerData);

      // Populate form fields
      setCustomerName(customerData.name);
      setCustomerType(customerData.customer_type);
      setEmail(customerData.email || '');
      setAccountNumber(customerData.account_no || '');
      setWebsite(customerData.website || '');
      setFax(customerData.fax || '');
      setIsActive(customerData.is_active);

      // Handle payment terms
      if (customerData.credit_limit && customerData.payment_term) {
        setPaymentTerm('credit');
        setCreditLimit(customerData.credit_limit.toString());
        setCreditPeriod(customerData.payment_term.toString());
      } else {
        setPaymentTerm('cash');
      }

      // Handle phone contacts
      if (customerData.contact) {
        setPhoneContacts([{ id: 1, person: '', number: customerData.contact, isPrimary: true }]);
      }

      // Handle addresses
      const billingAddress = customerData.addresses?.find((addr) => addr.type === 'billing');
      if (billingAddress) {
        setAddressLine(billingAddress.line1 || '');
        setAddressLine2(billingAddress.line2 || '');
        setCity(billingAddress.city || '');
        setPostalCode(billingAddress.zip_code || '');
        setProvince(billingAddress.province || '');
        setCountry(billingAddress.country || 'Sri Lanka');
        setCountrySearch(billingAddress.country || 'Sri Lanka');
      }

      // Handle existing documents
      setExistingDocuments(customerData.documents || []);
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('Error fetching customer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchCustomer();
    }
  }, [customerId]);

  // Contact management functions
  const addMoreContact = () => {
    const newId = Math.max(...phoneContacts.map((c) => c.id)) + 1;
    setPhoneContacts([...phoneContacts, { id: newId, person: '', number: '', isPrimary: false }]);
  };

  const updateContact = (id: number, field: keyof ContactInfo, value: string | boolean) => {
    setPhoneContacts((contacts) =>
      contacts.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact)),
    );
  };

  const removeContact = (id: number) => {
    if (phoneContacts.length > 1) {
      setPhoneContacts((contacts) => contacts.filter((contact) => contact.id !== id));
    }
  };

  // Document management functions
  const addDocument = () => {
    const newId = Math.max(...documents.map((d) => d.id), 0) + 1;
    setDocuments([...documents, { id: newId, file: null, title: '', description: '' }]);
  };

  const updateDocument = (id: number, field: keyof DocumentInfo, value: File | string | null) => {
    setDocuments((docs) => docs.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc)));
  };

  const removeDocument = (id: number) => {
    setDocuments((docs) => docs.filter((doc) => doc.id !== id));
  };

  const removeExistingDocument = async (documentId: number) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this document? This will permanently remove the file from storage and cannot be undone.',
      )
    ) {
      return;
    }

    try {
      // Call the specific document deletion endpoint
      // This follows the best practices from the documentation
      await api.delete(`/customers/${customerId}/documents/${documentId}/delete/`);

      // Remove document from local state immediately after successful deletion
      setExistingDocuments((docs) => docs.filter((doc) => doc.id !== documentId));

      toast.success('Document deleted successfully');
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      toast.error(`Failed to delete document: ${errorMessage}`);
      console.error('Error deleting document:', err);
    }
  };

  // Filter countries based on search input
  useEffect(() => {
    if (countrySearch.trim() === '' || countrySearch === country) {
      setFilteredCountries([]);
      setShowCountryDropdown(false);
      return;
    }

    const filtered = COUNTRIES.filter((country) =>
      country.toLowerCase().includes(countrySearch.toLowerCase()),
    ).slice(0, 8);

    setFilteredCountries(filtered);

    if (filtered.length > 0 && countrySearch !== country) {
      setShowCountryDropdown(true);
    }
  }, [countrySearch, country]);

  // Filter banks based on search input
  useEffect(() => {
    if (bankSearch.trim() === '' || bankSearch === bank) {
      setFilteredBanks([]);
      setShowBankDropdown(false);
      return;
    }

    const filtered = BANKS.filter((bankName) =>
      bankName.toLowerCase().includes(bankSearch.toLowerCase()),
    ).slice(0, 8);

    setFilteredBanks(filtered);

    if (filtered.length > 0 && bankSearch !== bank) {
      setShowBankDropdown(true);
    }
  }, [bankSearch, bank]);

  // Update payment term logic
  useEffect(() => {
    if (paymentTerm === 'credit') {
      setCreditPeriod('30');
    }
  }, [paymentTerm]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (paymentTerm === 'credit' && !creditLimit.trim()) {
      newErrors.creditLimit = 'Credit limit is required when payment term is Credit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = () => {
    router.push(`/dashboard/sales/customers/${customerId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setSaveLoading(true);

    try {
      const formData = new FormData();

      // Prepare customer data
      const customerData = {
        name: customerName,
        customer_type: customerType,
        email: email || null,
        contact: phoneContacts.find((c) => c.isPrimary)?.number || phoneContacts[0]?.number || null,
        account_no: accountNumber || null,
        website: website ? (website.startsWith('http') ? website : `https://${website}`) : null,
        fax: fax || null,
        credit_limit: paymentTerm === 'credit' && creditLimit ? parseFloat(creditLimit) : null,
        due_on_days: paymentTerm === 'credit' ? parseInt(creditPeriod) : null,
        payment_term: paymentTerm === 'credit' ? parseInt(creditPeriod) : null,
        is_active: isActive,
        addresses:
          addressLine || city || postalCode
            ? [
                {
                  type: 'billing',
                  line1: addressLine || '',
                  line2: addressLine2 || null,
                  city: city || '',
                  zip_code: postalCode || null,
                  province: province || null,
                  country: country || 'Sri Lanka',
                  phone:
                    phoneContacts.find((c) => c.isPrimary)?.number ||
                    phoneContacts[0]?.number ||
                    null,
                  delivery_instructions: null,
                },
              ]
            : [],
      };

      // Add customer data to FormData
      Object.keys(customerData).forEach((key) => {
        const value = (customerData as any)[key];
        if (value !== null && value !== undefined) {
          if (key === 'addresses' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      // Add new files to FormData
      documents.forEach((doc, index) => {
        if (doc.file) {
          formData.append(`document_file_${index}`, doc.file);
          formData.append(`document_title_${index}`, doc.title || doc.file.name);
          formData.append(`document_description_${index}`, doc.description || '');
        }
      });

      // Use PATCH for partial update
      await api.patch(`/customers/${customerId}/update/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Customer updated successfully!');
      router.push(`/dashboard/sales/customers/${customerId}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to update customer: ${errorMessage}`);
      console.error('Error updating customer:', error);
    } finally {
      setSaveLoading(false);
    }
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
              Back to Customer
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                color="gray"
                size="sm"
                onClick={handleBack}
                className="gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Customer</h1>
                <p className="text-gray-600 dark:text-gray-400">Update customer information</p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                color="gray"
                onClick={handleBack}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saveLoading}
                className="gap-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
              >
                <Save className="h-4 w-4" />
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Contact Information */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Contact Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Name */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="customerName"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Customer Name *
                    </Label>
                    <StandardTextInput
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      className={`h-11 ${errors.customerName ? 'border-red-500' : ''}`}
                      required
                    />
                    {errors.customerName && (
                      <p className="text-red-500 text-sm">{errors.customerName}</p>
                    )}
                  </div>

                  {/* Customer Type */}
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-700 dark:text-gray-300">
                      Customer Type
                    </Label>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Radio
                          id="individual"
                          name="customerType"
                          value="individual"
                          checked={customerType === 'individual'}
                          onChange={(e) =>
                            setCustomerType(e.target.value as 'individual' | 'business')
                          }
                        />
                        <Label htmlFor="individual" className="text-gray-700 dark:text-gray-300">
                          Individual
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Radio
                          id="business"
                          name="customerType"
                          value="business"
                          checked={customerType === 'business'}
                          onChange={(e) =>
                            setCustomerType(e.target.value as 'individual' | 'business')
                          }
                        />
                        <Label htmlFor="business" className="text-gray-700 dark:text-gray-300">
                          Business
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </Label>
                    <StandardTextInput
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email address"
                      className={`h-11 ${errors.email ? 'border-red-500' : ''}`}
                    />
                    {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isActive"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <Label htmlFor="isActive" className="text-gray-700 dark:text-gray-300">
                        Active Customer
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Phone Contacts */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="font-medium text-gray-700 dark:text-gray-300">
                      Phone Contacts
                    </Label>
                    <Button
                      type="button"
                      color="gray"
                      size="sm"
                      onClick={addMoreContact}
                      className="gap-2 text-primary-600 hover:text-primary-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add More
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {phoneContacts.map((contact, _index) => (
                      <div
                        key={contact.id}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                      >
                        <div className="space-y-2">
                          <Label className="font-medium text-gray-700 dark:text-gray-300">
                            Contact Name
                          </Label>
                          <StandardTextInput
                            value={contact.person}
                            onChange={(e) => updateContact(contact.id, 'person', e.target.value)}
                            placeholder="Enter contact name"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="font-medium text-gray-700 dark:text-gray-300">
                            Contact Number
                          </Label>
                          <StandardTextInput
                            value={contact.number}
                            onChange={(e) => updateContact(contact.id, 'number', e.target.value)}
                            placeholder="Enter phone number"
                            className="h-11"
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`primary-${contact.id}`}
                              checked={contact.isPrimary}
                              onChange={(e) => {
                                setPhoneContacts((contacts) =>
                                  contacts.map((c) => ({
                                    ...c,
                                    isPrimary: c.id === contact.id ? e.target.checked : false,
                                  })),
                                );
                              }}
                            />
                            <Label
                              htmlFor={`primary-${contact.id}`}
                              className="text-gray-700 dark:text-gray-300"
                            >
                              Primary
                            </Label>
                          </div>

                          {phoneContacts.length > 1 && (
                            <Button
                              type="button"
                              color="gray"
                              size="sm"
                              onClick={() => removeContact(contact.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Address Information */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Address Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Address Line 1 */}
                  <div className="space-y-2 md:col-span-2">
                    <Label
                      htmlFor="addressLine"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Address Line 1
                    </Label>
                    <StandardTextInput
                      id="addressLine"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="Enter address"
                      className="h-11"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div className="space-y-2 md:col-span-2">
                    <Label
                      htmlFor="addressLine2"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Address Line 2
                    </Label>
                    <StandardTextInput
                      id="addressLine2"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="Enter address line 2 (optional)"
                      className="h-11"
                    />
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-medium text-gray-700 dark:text-gray-300">
                      City
                    </Label>
                    <StandardTextInput
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter city"
                      className="h-11"
                    />
                  </div>

                  {/* Postal Code */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="postalCode"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Postal Code
                    </Label>
                    <StandardTextInput
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Enter postal code"
                      className="h-11"
                    />
                  </div>

                  {/* Province */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="province"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Province
                    </Label>
                    <StandardTextInput
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Enter province"
                      className="h-11"
                    />
                  </div>

                  {/* Country */}
                  <div className="space-y-2 relative">
                    <Label
                      htmlFor="country"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Country
                    </Label>
                    <StandardTextInput
                      id="country"
                      value={countrySearch}
                      onChange={(e) => {
                        setCountrySearch(e.target.value);
                        setShowCountryDropdown(true);
                      }}
                      onFocus={() => {
                        if (filteredCountries.length > 0 && countrySearch !== country) {
                          setShowCountryDropdown(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowCountryDropdown(false), 200);
                      }}
                      placeholder="Enter country"
                      className="h-11"
                    />

                    {/* Country Dropdown */}
                    {showCountryDropdown && filteredCountries.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCountries.map((country) => (
                          <div
                            key={country}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"
                            onClick={() => {
                              setCountry(country);
                              setCountrySearch(country);
                              setShowCountryDropdown(false);
                            }}
                          >
                            {country}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Terms */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Payment Terms
                </h2>

                <div className="space-y-6">
                  {/* Payment Term Radio */}
                  <div className="space-y-4">
                    <Label className="font-medium text-gray-700 dark:text-gray-300">
                      Payment Type
                    </Label>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Radio
                          id="cash"
                          name="paymentTerm"
                          value="cash"
                          checked={paymentTerm === 'cash'}
                          onChange={(e) => setPaymentTerm(e.target.value)}
                        />
                        <Label htmlFor="cash" className="text-gray-700 dark:text-gray-300">
                          Cash
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Radio
                          id="credit"
                          name="paymentTerm"
                          value="credit"
                          checked={paymentTerm === 'credit'}
                          onChange={(e) => setPaymentTerm(e.target.value)}
                        />
                        <Label htmlFor="credit" className="text-gray-700 dark:text-gray-300">
                          Credit
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Credit Options */}
                  {paymentTerm === 'credit' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="space-y-2">
                        <Label
                          htmlFor="creditPeriod"
                          className="font-medium text-gray-700 dark:text-gray-300"
                        >
                          Credit Period (Days)
                        </Label>
                        <StandardSelect
                          value={creditPeriod}
                          onChange={(e) => setCreditPeriod(e.target.value)}
                          className="h-11"
                        >
                          <option value="15">15 Days</option>
                          <option value="30">30 Days</option>
                          <option value="45">45 Days</option>
                          <option value="60">60 Days</option>
                          <option value="90">90 Days</option>
                        </StandardSelect>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="creditLimit"
                          className="font-medium text-gray-700 dark:text-gray-300"
                        >
                          Credit Limit (Rs.) *
                        </Label>
                        <StandardTextInput
                          id="creditLimit"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                          placeholder="Enter credit limit"
                          className={`h-11 ${errors.creditLimit ? 'border-red-500' : ''}`}
                        />
                        {errors.creditLimit && (
                          <p className="text-red-500 text-sm">{errors.creditLimit}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* More Information */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  More Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bank */}
                  <div className="space-y-2 relative">
                    <Label htmlFor="bank" className="font-medium text-gray-700 dark:text-gray-300">
                      Bank
                    </Label>
                    <StandardTextInput
                      id="bank"
                      value={bankSearch}
                      onChange={(e) => {
                        setBankSearch(e.target.value);
                        setShowBankDropdown(true);
                      }}
                      onFocus={() => {
                        if (filteredBanks.length > 0 && bankSearch !== bank) {
                          setShowBankDropdown(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowBankDropdown(false), 200);
                      }}
                      placeholder="Enter bank name"
                      className="h-11"
                    />

                    {/* Bank Dropdown */}
                    {showBankDropdown && filteredBanks.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredBanks.map((bankName) => (
                          <div
                            key={bankName}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"
                            onClick={() => {
                              setBank(bankName);
                              setBankSearch(bankName);
                              setShowBankDropdown(false);
                            }}
                          >
                            {bankName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Account Number */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="accountNumber"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Account Number
                    </Label>
                    <StandardTextInput
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Enter account number"
                      className="h-11"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="website"
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      Website
                    </Label>
                    <StandardTextInput
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="Enter website URL"
                      className="h-11"
                    />
                  </div>

                  {/* Fax */}
                  <div className="space-y-2">
                    <Label htmlFor="fax" className="font-medium text-gray-700 dark:text-gray-300">
                      Fax
                    </Label>
                    <StandardTextInput
                      id="fax"
                      value={fax}
                      onChange={(e) => setFax(e.target.value)}
                      placeholder="Enter fax number"
                      className="h-11"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Existing Documents
                  </h2>

                  <div className="space-y-4">
                    {existingDocuments.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                      >
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {document.title}
                          </h3>
                          {document.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {document.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Uploaded {new Date(document.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => window.open(document.file, '_blank')}
                            className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700 text-white"
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => removeExistingDocument(document.id)}
                            className="bg-gray-600 hover:bg-gray-700 focus:ring-gray-300 text-white border-gray-600 hover:border-gray-700 focus:ring-4 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* New Files Section */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Add New Files
                  </h2>
                  <Button
                    type="button"
                    color="gray"
                    size="sm"
                    onClick={addDocument}
                    className="gap-2 text-primary-600 hover:text-primary-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add File
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>No new files to upload. Click "Add File" to upload documents.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* File Upload */}
                          <div className="space-y-2">
                            <Label className="font-medium text-gray-700 dark:text-gray-300">
                              File
                            </Label>
                            <input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                updateDocument(document.id, 'file', file);
                                if (file && !document.title) {
                                  updateDocument(document.id, 'title', file.name);
                                }
                              }}
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                              className="block w-full text-sm text-gray-500 dark:text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-medium
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100
                                dark:file:bg-primary-900 dark:file:text-primary-300
                                dark:hover:file:bg-primary-800"
                            />
                            {document.file && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Selected: {document.file.name} (
                                {(document.file.size / 1024 / 1024).toFixed(2)} MB)
                              </p>
                            )}
                          </div>

                          {/* Title */}
                          <div className="space-y-2">
                            <Label className="font-medium text-gray-700 dark:text-gray-300">
                              Title
                            </Label>
                            <StandardTextInput
                              value={document.title}
                              onChange={(e) => updateDocument(document.id, 'title', e.target.value)}
                              placeholder="Enter document title"
                              className="h-11"
                            />
                          </div>

                          {/* Description */}
                          <div className="space-y-2">
                            <Label className="font-medium text-gray-700 dark:text-gray-300">
                              Description
                            </Label>
                            <StandardTextInput
                              value={document.description}
                              onChange={(e) =>
                                updateDocument(document.id, 'description', e.target.value)
                              }
                              placeholder="Enter description (optional)"
                              className="h-11"
                            />
                          </div>
                        </div>

                        {/* Remove Button */}
                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => removeDocument(document.id)}
                            className="bg-gray-600 hover:bg-gray-700 focus:ring-gray-300 text-white border-gray-600 hover:border-gray-700 focus:ring-4 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800"
                          >
                            Remove File
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Bottom Action Buttons */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                color="gray"
                onClick={handleBack}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveLoading}
                className="gap-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
              >
                <Save className="h-4 w-4" />
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
