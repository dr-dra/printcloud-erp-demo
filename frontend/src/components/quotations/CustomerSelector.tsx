'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiChevronDown, HiCheck } from 'react-icons/hi';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import CustomerModal from '@/components/common/CustomerModal';

interface Customer {
  id: number;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
}

interface CustomerSelectorProps {
  value: number | null;
  onChange: (customerId: number | null) => void;
  error?: string;
}

export default function CustomerSelector({ value, onChange, error }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load customers on component mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Update selected customer when value changes
  useEffect(() => {
    if (value && customers.length > 0) {
      const customer = customers.find((c) => c.id === value);
      if (customer) {
        setSelectedCustomer(customer);
        setSearchQuery(customer.name);
      }
    } else {
      setSelectedCustomer(null);
      setSearchQuery('');
    }
  }, [value, customers]);

  // Filter customers based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (customer.company_name &&
            customer.company_name.toLowerCase().includes(searchQuery.toLowerCase())),
      );
      setFilteredCustomers(filtered);
    }
  }, [customers, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/customers/?page_size=1000'); // Load all customers for selector
      setCustomers(response.data.results || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.name);
    onChange(customer.id);
    setIsOpen(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query) {
      setSelectedCustomer(null);
      onChange(null);
    }

    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleCreateCustomer = () => {
    setShowCreateModal(true);
    setIsOpen(false);
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setCustomers((prev) => [...prev, newCustomer]);
    setSelectedCustomer(newCustomer);
    setSearchQuery(newCustomer.name);
    onChange(newCustomer.id);
    setShowCreateModal(false);
    toast.success('Customer created successfully');
  };

  const displayValue = selectedCustomer ? selectedCustomer.name : searchQuery;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <StandardTextInput
          ref={inputRef}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="Search or select customer..."
          color={error ? 'failure' : 'gray'}
          rightIcon={loading ? undefined : HiChevronDown}
        />

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Create Customer Option */}
          <div
            onClick={handleCreateCustomer}
            className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600"
          >
            <HiPlus className="w-4 h-4 mr-2 text-blue-500" />
            <span className="text-blue-500 font-medium">Create New Customer</span>
          </div>

          {/* Customers List */}
          {filteredCustomers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Loading...' : 'No customers found'}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                  selectedCustomer?.id === customer.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{customer.name}</div>
                  {customer.company_name && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {customer.company_name}
                    </div>
                  )}
                </div>
                {selectedCustomer?.id === customer.id && (
                  <HiCheck className="w-4 h-4 text-blue-500" />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Customer Creation Modal */}
      {showCreateModal && (
        <CustomerModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCustomerCreated={handleCustomerCreated}
        />
      )}
    </div>
  );
}
