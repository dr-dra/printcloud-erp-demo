'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Label, Checkbox, Radio } from 'flowbite-react';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import { Plus, Save, X, User, MapPin, CreditCard, Info, Phone, Trash2 } from 'lucide-react';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { SlPeople } from 'react-icons/sl';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import CircularProgress from './CircularProgress';
import { useFormCompletion } from '@/hooks/useFormCompletion';

interface ContactInfo {
  id: number;
  person: string;
  number: string;
  isPrimary: boolean;
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: (customer: any) => void;
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

export default function CustomerModal({ isOpen, onClose, onCustomerCreated }: CustomerModalProps) {
  const [activeTab, setActiveTab] = useState('contact');
  const [loading, setLoading] = useState(false);

  // Refs for auto-focus
  const customerNameRef = useRef<HTMLInputElement>(null);
  const addressLineRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<'individual' | 'business'>('business');
  const [email, setEmail] = useState('');
  const [phoneContacts, setPhoneContacts] = useState<ContactInfo[]>([
    { id: 1, person: '', number: '', isPrimary: true },
  ]);

  // Address state
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [countrySearch, setCountrySearch] = useState('Sri Lanka');
  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Payment Terms state
  const [paymentTerm, setPaymentTerm] = useState('cash');
  const [creditPeriod, setCreditPeriod] = useState('30');
  const [creditLimit, setCreditLimit] = useState('');

  // More Info state
  const [accountNumber, setAccountNumber] = useState('');
  const [bank, setBank] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [filteredBanks, setFilteredBanks] = useState<string[]>([]);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [website, setWebsite] = useState('');
  const [fax, setFax] = useState('');

  // Validation states
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Form completion tracking
  const {
    percentage,
    filledCount: _filledCount,
    totalCount: _totalCount,
  } = useFormCompletion(
    customerName,
    email,
    phoneContacts,
    addressLine,
    city,
    paymentTerm,
    creditLimit,
    country,
  );

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

  // Auto-focus first field when tab changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const focusTimer = setTimeout(() => {
      switch (activeTab) {
        case 'contact':
          customerNameRef.current?.focus();
          break;
        case 'address':
          addressLineRef.current?.focus();
          break;
        case 'payment':
          // Focus stays on tab, no auto-focus for radio buttons
          break;
        case 'more':
          bankRef.current?.focus();
          break;
      }
    }, 100);

    return () => clearTimeout(focusTimer);
  }, [activeTab]);

  // Keyboard navigation between tabs (Ctrl/Cmd + Arrow Left/Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const tabs = ['contact', 'address', 'payment', 'more'];
        const currentIndex = tabs.indexOf(activeTab);

        if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
          e.preventDefault();
          setActiveTab(tabs[currentIndex + 1]);
        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
          e.preventDefault();
          setActiveTab(tabs[currentIndex - 1]);
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, activeTab]);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\d\s+()-]+$/;
    return phoneRegex.test(phone) && phone.trim().length >= 7;
  };

  const validateWebsite = (url: string): boolean => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Customer name is required
    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    // Email validation (if provided)
    if (email && !validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation
    phoneContacts.forEach((contact) => {
      if (contact.number && !validatePhone(contact.number)) {
        newErrors[`phone_${contact.id}`] = 'Please enter a valid phone number';
      }
    });

    // Credit limit required if payment term is credit
    if (paymentTerm === 'credit' && !creditLimit.trim()) {
      newErrors.creditLimit = 'Credit limit is required when payment term is Credit';
    }

    // Website validation (if provided)
    if (website && !validateWebsite(website)) {
      newErrors.website = 'Please enter a valid website URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setCustomerName('');
    setCustomerType('business');
    setEmail('');
    setPhoneContacts([{ id: 1, person: '', number: '', isPrimary: true }]);
    setAddressLine('');
    setCity('');
    setPostalCode('');
    setProvince('');
    setCountry('Sri Lanka');
    setCountrySearch('Sri Lanka');
    setPaymentTerm('cash');
    setCreditPeriod('30');
    setCreditLimit('');
    setAccountNumber('');
    setBank('');
    setBankSearch('');
    setWebsite('');
    setFax('');
    setErrors({});
    setActiveTab('contact');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

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
        is_active: true,
        addresses:
          addressLine || city || postalCode
            ? [
                {
                  type: 'billing',
                  line1: addressLine || '',
                  line2: null,
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

      const response = await api.post('/customers/create/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Customer added successfully!');

      if (onCustomerCreated) {
        onCustomerCreated(response.data);
      }

      handleClose();
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to add customer: ${errorMessage}`);
      console.error('Error creating customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contact':
        return (
          <div className="space-y-4">
            {/* Basic Information Section */}
            <div className="section-card">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-primary-600" />
                Basic Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Name */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="customerName"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Customer Name <span className="text-red-500">*</span>
                  </Label>
                  <StandardTextInput
                    ref={customerNameRef}
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., ABC Printing Co."
                    className={`${errors.customerName ? 'border-red-400' : ''}`}
                    required
                    autoComplete="organization"
                  />
                  {errors.customerName && (
                    <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.customerName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Email Address
                  </Label>
                  <StandardTextInput
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., contact@abcprinting.com"
                    className={`${errors.email ? 'border-red-400' : ''}`}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Customer Type */}
              <div className="mt-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Customer Type
                </Label>
                <div className="flex gap-3">
                  <label
                    htmlFor="individual"
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      customerType === 'individual'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <Radio
                      id="individual"
                      name="customerType"
                      value="individual"
                      checked={customerType === 'individual'}
                      onChange={(e) => setCustomerType(e.target.value as 'individual' | 'business')}
                      className="text-primary-600"
                    />
                    <User
                      className={`h-4 w-4 ${customerType === 'individual' ? 'text-primary-600' : 'text-gray-500'}`}
                    />
                    <span
                      className={`text-sm font-medium ${customerType === 'individual' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-700 dark:text-gray-400'}`}
                    >
                      Individual
                    </span>
                  </label>
                  <label
                    htmlFor="business"
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      customerType === 'business'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <Radio
                      id="business"
                      name="customerType"
                      value="business"
                      checked={customerType === 'business'}
                      onChange={(e) => setCustomerType(e.target.value as 'individual' | 'business')}
                      className="text-primary-600"
                    />
                    <User
                      className={`h-4 w-4 ${customerType === 'business' ? 'text-primary-600' : 'text-gray-500'}`}
                    />
                    <span
                      className={`text-sm font-medium ${customerType === 'business' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-700 dark:text-gray-400'}`}
                    >
                      Business
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Phone Contacts Section */}
            <div className="section-card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary-600" />
                  Phone Contacts
                </h4>
                <Button
                  type="button"
                  size="xs"
                  onClick={addMoreContact}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Contact
                </Button>
              </div>

              <div className="space-y-3">
                {phoneContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`phone-contact-card ${contact.isPrimary ? 'primary-contact' : ''} p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Contact Name
                        </Label>
                        <StandardTextInput
                          value={contact.person}
                          onChange={(e) => updateContact(contact.id, 'person', e.target.value)}
                          placeholder="e.g., John Smith"
                          autoComplete="name"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Phone Number
                        </Label>
                        <StandardTextInput
                          type="tel"
                          value={contact.number}
                          onChange={(e) => updateContact(contact.id, 'number', e.target.value)}
                          placeholder="e.g., +94 77 123 4567"
                          className={`${errors[`phone_${contact.id}`] ? 'border-red-400' : ''}`}
                          autoComplete="tel"
                        />
                        {errors[`phone_${contact.id}`] && (
                          <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                            <X className="h-3 w-3" />
                            {errors[`phone_${contact.id}`]}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <label
                        htmlFor={`primary-${contact.id}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
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
                          className="text-primary-600"
                        />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-400">
                          Primary Contact
                        </span>
                      </label>

                      {phoneContacts.length > 1 && (
                        <Button
                          type="button"
                          size="xs"
                          color="gray"
                          onClick={() => removeContact(contact.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-4">
            <div className="section-card">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary-600" />
                Location Details
              </h4>

              <div className="space-y-4">
                {/* Address Line 1 */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="addressLine"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Street Address
                  </Label>
                  <StandardTextInput
                    ref={addressLineRef}
                    id="addressLine"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="e.g., 123 Main Street, Suite 4B"
                    autoComplete="street-address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* City */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="city"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      City
                    </Label>
                    <StandardTextInput
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g., Colombo"
                      autoComplete="address-level2"
                    />
                  </div>

                  {/* Postal Code */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="postalCode"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Postal Code
                    </Label>
                    <StandardTextInput
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g., 00100"
                      autoComplete="postal-code"
                    />
                  </div>

                  {/* Province */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="province"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Province / State
                    </Label>
                    <StandardTextInput
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="e.g., Western Province"
                      autoComplete="address-level1"
                    />
                  </div>

                  {/* Country */}
                  <div className="space-y-1.5 relative">
                    <Label
                      htmlFor="country"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                      placeholder="Start typing to search..."
                      autoComplete="country-name"
                    />

                    {/* Country Dropdown */}
                    {showCountryDropdown && filteredCountries.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCountries.map((country) => (
                          <div
                            key={country}
                            className="px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-gray-900 dark:text-gray-100 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
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
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-4">
            <div className="section-card">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary-600" />
                Payment Terms
              </h4>

              {/* Payment Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                  Payment Type
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    htmlFor="cash"
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      paymentTerm === 'cash'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <Radio
                      id="cash"
                      name="paymentTerm"
                      value="cash"
                      checked={paymentTerm === 'cash'}
                      onChange={(e) => setPaymentTerm(e.target.value)}
                      className="text-primary-600"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Cash Payment
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Immediate payment</p>
                    </div>
                  </label>

                  <label
                    htmlFor="credit"
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      paymentTerm === 'credit'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <Radio
                      id="credit"
                      name="paymentTerm"
                      value="credit"
                      checked={paymentTerm === 'credit'}
                      onChange={(e) => setPaymentTerm(e.target.value)}
                      className="text-primary-600"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Credit Terms
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Deferred payment</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Credit Options */}
              {paymentTerm === 'credit' && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="creditPeriod"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Credit Period (Days)
                      </Label>
                      <StandardSelect
                        value={creditPeriod}
                        onChange={(e) => setCreditPeriod(e.target.value)}
                      >
                        <option value="15">15 Days</option>
                        <option value="30">30 Days</option>
                        <option value="45">45 Days</option>
                        <option value="60">60 Days</option>
                        <option value="90">90 Days</option>
                      </StandardSelect>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="creditLimit"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Credit Limit (Rs.) <span className="text-red-500">*</span>
                      </Label>
                      <StandardTextInput
                        id="creditLimit"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        placeholder="e.g., 100000"
                        className={`${errors.creditLimit ? 'border-red-400' : ''}`}
                      />
                      {errors.creditLimit && (
                        <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                          <X className="h-3 w-3" />
                          {errors.creditLimit}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'more':
        return (
          <div className="space-y-4">
            {/* Banking Information */}
            <div className="section-card">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                  />
                </svg>
                Banking Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank */}
                <div className="space-y-1.5 relative">
                  <Label
                    htmlFor="bank"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Bank Name
                  </Label>
                  <StandardTextInput
                    ref={bankRef}
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
                    placeholder="Start typing to search..."
                  />

                  {/* Bank Dropdown */}
                  {showBankDropdown && filteredBanks.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredBanks.map((bankName) => (
                        <div
                          key={bankName}
                          className="px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-gray-900 dark:text-gray-100 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
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
                <div className="space-y-1.5">
                  <Label
                    htmlFor="accountNumber"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Account Number
                  </Label>
                  <StandardTextInput
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g., 1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="section-card">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary-600" />
                Additional Contact Details
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Website */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="website"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Website URL
                  </Label>
                  <StandardTextInput
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g., www.example.com"
                    className={`${errors.website ? 'border-red-400' : ''}`}
                  />
                  {errors.website && (
                    <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.website}
                    </p>
                  )}
                </div>

                {/* Fax */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="fax"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Fax Number
                  </Label>
                  <StandardTextInput
                    id="fax"
                    value={fax}
                    onChange={(e) => setFax(e.target.value)}
                    placeholder="e.g., +94 11 234 5678"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* eslint-disable react/no-unknown-property */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap');

        .customer-modal-container {
          font-family:
            'Manrope',
            system-ui,
            -apple-system,
            sans-serif;
        }

        .customer-modal-title {
          font-family:
            'Outfit',
            system-ui,
            -apple-system,
            sans-serif;
        }

        .tab-pill {
          position: relative;
          transition: all 0.2s ease;
        }

        .tab-pill::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 80%;
          height: 2px;
          background: #236bb4;
          border-radius: 2px 2px 0 0;
          transition: transform 0.2s ease;
        }

        .tab-pill.active::before {
          transform: translateX(-50%) scaleX(1);
        }

        .phone-contact-card {
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .phone-contact-card.primary-contact {
          border-color: #236bb4;
          background: rgba(35, 107, 180, 0.03);
        }

        .section-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
        }

        .dark .section-card {
          background: #1f2937;
          border-color: #4b5563;
        }

        /* Override Flowbite's cyan focus ring to use primary teal color for ALL input types */
        .customer-modal-container input[type='text']:focus,
        .customer-modal-container input[type='email']:focus,
        .customer-modal-container input[type='tel']:focus,
        .customer-modal-container input[type='number']:focus,
        .customer-modal-container input:not([type]):focus {
          --tw-ring-opacity: 1 !important;
          --tw-ring-color: rgb(35 107 180 / var(--tw-ring-opacity)) !important;
          border-color: rgb(35 107 180) !important;
        }

        .customer-modal-container select:focus {
          --tw-ring-opacity: 1 !important;
          --tw-ring-color: rgb(35 107 180 / var(--tw-ring-opacity)) !important;
          border-color: rgb(35 107 180) !important;
        }

        .dark .customer-modal-container input[type='text']:focus,
        .dark .customer-modal-container input[type='email']:focus,
        .dark .customer-modal-container input[type='tel']:focus,
        .dark .customer-modal-container input[type='number']:focus,
        .dark .customer-modal-container input:not([type]):focus {
          --tw-ring-color: rgb(56 189 248 / var(--tw-ring-opacity)) !important;
          border-color: rgb(56 189 248) !important;
        }

        .dark .customer-modal-container select:focus {
          --tw-ring-color: rgb(56 189 248 / var(--tw-ring-opacity)) !important;
          border-color: rgb(56 189 248) !important;
        }
      `}</style>
      {/* eslint-enable react/no-unknown-property */}

      <Modal show={isOpen} onClose={handleClose} size="4xl" className="bg-gray-900/50">
        <div className="customer-modal-container bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <SlPeople className="h-5 w-5 text-primary-600" />
                  <h3 className="customer-modal-title text-xl font-bold text-gray-900 dark:text-white">
                    Add New Customer
                  </h3>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 ml-8 flex items-center gap-2">
                  <HiOutlineLightBulb className="h-3.5 w-3.5 text-amber-500" />
                  Complete details ensure smooth operations and accurate billing
                </p>
              </div>
              <div className="flex items-center gap-8">
                <CircularProgress
                  percentage={percentage}
                  size={44}
                  strokeWidth={3}
                  showPercentage={true}
                  animated={true}
                />
                <button
                  onClick={handleClose}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
              {[
                { key: 'contact', label: 'Contact Info', icon: User },
                { key: 'address', label: 'Address', icon: MapPin },
                { key: 'payment', label: 'Payment', icon: CreditCard },
                { key: 'more', label: 'More Info', icon: Info },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`tab-pill ${isActive ? 'active' : ''} flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all ${
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{renderTabContent()}</div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fields marked with <span className="text-red-500 font-semibold">*</span> are
                  required
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Tip: Use{' '}
                  <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                    Ctrl
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                    ←
                  </kbd>{' '}
                  <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                    →
                  </kbd>{' '}
                  to navigate tabs
                </p>
              </div>
              <div className="flex gap-3">
                <Button color="gray" onClick={handleClose} size="sm">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  size="sm"
                  className="bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Customer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
