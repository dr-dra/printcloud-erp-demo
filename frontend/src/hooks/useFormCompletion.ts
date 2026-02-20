import { useMemo } from 'react';

interface ContactInfo {
  id: number;
  person: string;
  number: string;
  isPrimary: boolean;
}

interface FormField {
  name: string;
  label: string;
  filled: boolean;
}

interface UseFormCompletionReturn {
  percentage: number;
  filledCount: number;
  totalCount: number;
  fields: FormField[];
}

/**
 * useFormCompletion - Calculate form completion percentage in real-time
 *
 * Tracks 8 key fields to determine customer profile completeness:
 * 1. Customer Name (required)
 * 2. Email Address
 * 3. Phone Number
 * 4. Street Address
 * 5. City
 * 6. Payment Type (always filled)
 * 7. Credit Limit (conditional)
 * 8. Country (defaults to Sri Lanka)
 *
 * @param customerName - Customer name field value
 * @param email - Email address field value
 * @param phoneContacts - Array of phone contact objects
 * @param addressLine - Street address field value
 * @param city - City field value
 * @param paymentTerm - Payment term type ('cash' or 'credit')
 * @param creditLimit - Credit limit field value
 * @param country - Country field value
 * @returns Object with percentage, filled count, total count, and field details
 *
 * @example
 * ```tsx
 * const { percentage, filledCount, totalCount } = useFormCompletion(
 *   customerName,
 *   email,
 *   phoneContacts,
 *   addressLine,
 *   city,
 *   paymentTerm,
 *   creditLimit,
 *   country
 * );
 * ```
 */
export function useFormCompletion(
  customerName: string,
  email: string,
  phoneContacts: ContactInfo[],
  addressLine: string,
  city: string,
  paymentTerm: string,
  creditLimit: string,
  country: string,
): UseFormCompletionReturn {
  return useMemo(() => {
    const fields: FormField[] = [
      {
        name: 'customerName',
        label: 'Customer Name',
        filled: customerName.trim().length > 0,
      },
      {
        name: 'email',
        label: 'Email Address',
        filled: email.trim().length > 0,
      },
      {
        name: 'phone',
        label: 'Phone Number',
        filled: phoneContacts.some((c) => c.number.trim().length > 0),
      },
      {
        name: 'address',
        label: 'Street Address',
        filled: addressLine.trim().length > 0,
      },
      {
        name: 'city',
        label: 'City',
        filled: city.trim().length > 0,
      },
      {
        name: 'paymentType',
        label: 'Payment Type',
        filled: true, // Always selected (defaults to 'cash')
      },
      {
        name: 'creditLimit',
        label: 'Credit Limit',
        // Only required if payment type is 'credit', otherwise considered filled
        filled: paymentTerm === 'credit' ? creditLimit.trim().length > 0 : true,
      },
      {
        name: 'country',
        label: 'Country',
        filled: country.trim().length > 0, // Defaults to 'Sri Lanka'
      },
    ];

    const filledCount = fields.filter((f) => f.filled).length;
    const totalCount = fields.length;
    const percentage = Math.round((filledCount / totalCount) * 100);

    return {
      percentage,
      filledCount,
      totalCount,
      fields,
    };
  }, [customerName, email, phoneContacts, addressLine, city, paymentTerm, creditLimit, country]);
}
