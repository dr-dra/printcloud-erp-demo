'use client';

import { useMemo, useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Spinner, Button, Dropdown } from 'flowbite-react';
import {
  HiArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineUpload,
  HiOutlinePencil,
  HiOutlineExclamationCircle,
  HiOutlineSparkles,
  HiDotsVertical,
  HiOutlineTrash,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import {
  useCreateSupplierBill,
  useSuppliers,
  useUploadBillScan,
  useBillScan,
} from '@/hooks/useSuppliers';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';

export default function NewSupplierBillPage() {
  const router = useRouter();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers({ is_active: true });
  const createBill = useCreateSupplierBill();

  // AI Scanning hooks
  const uploadBillScan = useUploadBillScan();
  const [scanId, setScanId] = useState<number | null>(null);
  const { data: billScan } = useBillScan(scanId);
  const [isDragging, setIsDragging] = useState(false);

  const [form, setForm] = useState({
    internal_reference: '',
    bill_number: '',
    supplier: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subtotal: '',
    tax_amount: '0',
    discount_amount: '0',
    notes: '',
  });

  // Track which fields user has edited (for AI mode)
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});

  const normalizeAmountValue = (value: unknown) => {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[^0-9.-]/g, '');
  };

  const normalizeDateValue = (value: unknown) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const dayFirstMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (dayFirstMatch) {
      const [, day, month, year] = dayFirstMatch;
      return `${year}-${month}-${day}`;
    }
    return raw;
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (scanId) {
      setEditedFields((prev) => ({ ...prev, [field]: true }));
    }
  };

  // Auto-populate form from AI extraction
  useEffect(() => {
    if (billScan?.processing_status === 'completed' && billScan.extracted_data) {
      const extracted = billScan.extracted_data;

      setForm((prev) => ({
        ...prev,
        bill_number: extracted.bill_number?.value || prev.bill_number,
        bill_date: normalizeDateValue(extracted.bill_date?.value) || prev.bill_date,
        due_date: normalizeDateValue(extracted.due_date?.value) || prev.due_date || prev.bill_date,
        subtotal: normalizeAmountValue(extracted.subtotal?.value) || prev.subtotal,
        tax_amount: normalizeAmountValue(extracted.tax_amount?.value) || '0',
        discount_amount: normalizeAmountValue(extracted.discount_amount?.value) || '0',
      }));

      // Auto-select matched supplier
      if (billScan.matched_supplier) {
        setForm((prev) => ({ ...prev, supplier: String(billScan.matched_supplier) }));
      }
    }
  }, [billScan]);

  // Handle file selection and upload
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF, JPG, and PNG files are supported.');
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      alert('File size must be less than 100MB.');
      return;
    }

    try {
      const scan = await uploadBillScan.mutateAsync(file);
      setScanId(scan.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'Failed to upload file.'));
    }
  };

  const computedTotal = useMemo(() => {
    const subtotal = parseFloat(normalizeAmountValue(form.subtotal) || '0');
    const tax = parseFloat(normalizeAmountValue(form.tax_amount) || '0');
    const discount = parseFloat(normalizeAmountValue(form.discount_amount) || '0');
    return subtotal + tax - discount;
  }, [form.subtotal, form.tax_amount, form.discount_amount]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Confidence indicator component
  const ConfidenceIndicator = ({ field }: { field: string }) => {
    // Only show confidence indicators when we have AI-extracted data
    if (!scanId || !billScan?.extracted_data) return null;

    const extractedField = billScan.extracted_data[field as keyof typeof billScan.extracted_data];
    if (!extractedField) return null;

    const confidence = extractedField.confidence;
    const wasEdited = editedFields[field] || billScan.user_edited_fields?.[field];

    if (wasEdited) {
      return (
        <Badge color="info" icon={HiOutlinePencil} size="xs">
          Edited
        </Badge>
      );
    }

    if (confidence >= 0.85) {
      return (
        <Badge color="success" size="xs">
          {Math.round(confidence * 100)}%
        </Badge>
      );
    } else if (confidence >= 0.7) {
      return (
        <Badge color="warning" size="xs">
          {Math.round(confidence * 100)}%
        </Badge>
      );
    } else {
      return (
        <Badge color="failure" size="xs">
          {Math.round(confidence * 100)}%
        </Badge>
      );
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const sanitizedSubtotal = normalizeAmountValue(form.subtotal);
    const sanitizedTax = normalizeAmountValue(form.tax_amount) || '0';
    const sanitizedDiscount = normalizeAmountValue(form.discount_amount) || '0';

    if (!form.internal_reference || !form.bill_number || !form.supplier || !sanitizedSubtotal) {
      toast.error(
        'Please fill in all required fields: Internal reference, bill number, supplier, and subtotal.',
      );
      return;
    }

    try {
      const normalizedBillDate = normalizeDateValue(form.bill_date) || form.bill_date;
      const normalizedDueDate =
        normalizeDateValue(form.due_date || form.bill_date) || form.due_date || form.bill_date;
      const created = await createBill.mutateAsync({
        internal_reference: form.internal_reference.trim(),
        bill_number: form.bill_number.trim(),
        supplier: Number(form.supplier),
        bill_date: normalizedBillDate,
        due_date: normalizedDueDate,
        subtotal: sanitizedSubtotal,
        tax_amount: sanitizedTax,
        discount_amount: sanitizedDiscount,
        notes: form.notes || undefined,
        scan_id: scanId || undefined,
      });
      toast.success('Supplier bill created successfully.');
      // Redirect to bills list with highlight parameter
      router.push(`/dashboard/purchases/bills?highlight=${created.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error(getErrorMessage(err, 'Failed to create supplier bill.'));
    }
  };

  // Handle remove uploaded document
  const handleRemoveDocument = () => {
    setScanId(null);
    setForm({
      internal_reference: '',
      bill_number: '',
      supplier: '',
      bill_date: new Date().toISOString().split('T')[0],
      due_date: '',
      subtotal: '',
      tax_amount: '0',
      discount_amount: '0',
      notes: '',
    });
    setEditedFields({});
  };

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        {/* Compact Header - Following PrintCloud Order View Pattern */}
        <div className="mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => router.push('/dashboard/purchases/bills')}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
                    title="Back to Bills"
                  >
                    <HiArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-3 min-w-0">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      New Supplier Bill
                    </h1>
                    {billScan?.processing_status && (
                      <Badge
                        color={
                          billScan.processing_status === 'completed'
                            ? 'success'
                            : billScan.processing_status === 'processing'
                              ? 'info'
                              : billScan.processing_status === 'failed'
                                ? 'failure'
                                : 'gray'
                        }
                        size="xs"
                      >
                        {billScan.processing_status === 'completed' && 'AI Extracted'}
                        {billScan.processing_status === 'processing' && 'Processing...'}
                        {billScan.processing_status === 'failed' && 'Failed'}
                        {billScan.processing_status === 'pending' && 'Pending'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {scanId && (
                    <Dropdown
                      label=""
                      renderTrigger={() => (
                        <Button color="gray" size="xs">
                          <HiDotsVertical className="h-4 w-4" />
                        </Button>
                      )}
                    >
                      <Dropdown.Item onClick={handleRemoveDocument} icon={HiOutlineTrash}>
                        Remove Document
                      </Dropdown.Item>
                    </Dropdown>
                  )}
                </div>
              </div>

              {billScan?.matched_supplier && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <HiOutlineCheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {billScan.matched_supplier_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({Math.round((billScan.supplier_match_confidence || 0) * 100)}% match)
                    </span>
                  </div>
                </div>
              )}

              {billScan?.summary && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                  {billScan.summary}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area - Always 50/50 Layout */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Left: Document Preview/Upload Area (50%) */}
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full">
              <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 px-4 py-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Document Preview
                </span>
              </div>

              {/* Upload State */}
              {!scanId && (
                <div
                  className={`p-4 h-full flex items-center justify-center transition-colors ${
                    isDragging
                      ? 'bg-purple-50 dark:bg-purple-900/10 border-2 border-dashed border-purple-400 dark:border-purple-600'
                      : ''
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      handleFileSelect({
                        target: { files: [file] },
                      } as ChangeEvent<HTMLInputElement>);
                    }
                  }}
                >
                  <div className="text-center max-w-sm mx-auto">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                      <HiOutlineSparkles className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Upload Bill Document
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Drag and drop your bill here, or click to browse
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white hover:bg-purple-700 transition-colors shadow-sm">
                      <HiOutlineUpload className="h-5 w-5" />
                      Choose File
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploadBillScan.isPending}
                      />
                    </label>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      PDF, JPG, PNG (Max 100MB)
                    </p>
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Don't have a document? Just fill in the form manually →
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing State */}
              {billScan && billScan.processing_status === 'processing' && (
                <div className="p-4 h-full flex items-center justify-center">
                  <div className="text-center">
                    <Spinner size="xl" />
                    <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
                      AI is processing your document...
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {billScan.file_name}
                    </p>
                  </div>
                </div>
              )}

              {/* Failed State */}
              {billScan && billScan.processing_status === 'failed' && (
                <div className="p-4 h-full flex items-center justify-center">
                  <div className="text-center max-w-sm mx-auto">
                    <HiOutlineExclamationCircle className="mx-auto h-12 w-12 text-red-600 dark:text-red-400" />
                    <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                      Processing Failed
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {billScan.processing_error ||
                        'An error occurred while processing the document.'}
                    </p>
                    <div className="mt-6">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Please go back and try uploading a different document
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Preview State */}
              {billScan && billScan.processing_status === 'completed' && (
                <div className="p-4 h-full">
                  {billScan.file_type === 'application/pdf' ? (
                    <iframe
                      src={billScan.file}
                      className="w-full h-full rounded border border-gray-200 dark:border-gray-600"
                      title="Bill Document"
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={billScan.file}
                        alt="Bill Document"
                        className="w-full h-full object-contain rounded border border-gray-200 dark:border-gray-600"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Data Entry Form (50%) - Always Visible */}
          <div className="flex-1 min-w-0">
            <div className="space-y-4">
              {/* Bill Details Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Bill Information
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label
                      htmlFor="internal_reference"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Internal Reference *
                    </label>
                    <input
                      id="internal_reference"
                      type="text"
                      value={form.internal_reference}
                      onChange={(e) => updateForm('internal_reference', e.target.value)}
                      placeholder="e.g., BILL-2026-001"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="bill_number"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      <span className="inline-flex items-center gap-2">
                        Bill Number *
                        <ConfidenceIndicator field="bill_number" />
                      </span>
                    </label>
                    <input
                      id="bill_number"
                      type="text"
                      value={form.bill_number}
                      onChange={(e) => updateForm('bill_number', e.target.value)}
                      placeholder="Supplier's bill number"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="supplier"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Supplier *
                    </label>
                    <select
                      id="supplier"
                      value={form.supplier}
                      onChange={(e) => updateForm('supplier', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      required
                    >
                      <option value="">
                        {suppliersLoading ? 'Loading...' : 'Select supplier'}
                      </option>
                      {Array.isArray(suppliers) &&
                        suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.supplier_code} - {supplier.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="bill_date"
                        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        <span className="inline-flex items-center gap-2">
                          Bill Date *
                          <ConfidenceIndicator field="bill_date" />
                        </span>
                      </label>
                      <input
                        id="bill_date"
                        type="date"
                        value={form.bill_date}
                        onChange={(e) => updateForm('bill_date', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="due_date"
                        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        <span className="inline-flex items-center gap-2">
                          Due Date
                          <ConfidenceIndicator field="due_date" />
                        </span>
                      </label>
                      <input
                        id="due_date"
                        type="date"
                        value={form.due_date}
                        onChange={(e) => updateForm('due_date', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Amounts Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Amounts</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="subtotal"
                        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        <span className="inline-flex items-center gap-2">
                          Subtotal *
                          <ConfidenceIndicator field="subtotal" />
                        </span>
                      </label>
                      <input
                        id="subtotal"
                        type="number"
                        step="0.01"
                        value={form.subtotal}
                        onChange={(e) => updateForm('subtotal', e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-right font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="tax_amount"
                        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        <span className="inline-flex items-center gap-2">
                          Tax
                          <ConfidenceIndicator field="tax_amount" />
                        </span>
                      </label>
                      <input
                        id="tax_amount"
                        type="number"
                        step="0.01"
                        value={form.tax_amount}
                        onChange={(e) => updateForm('tax_amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-right font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="discount_amount"
                        className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        <span className="inline-flex items-center gap-2">
                          Discount
                          <ConfidenceIndicator field="discount_amount" />
                        </span>
                      </label>
                      <input
                        id="discount_amount"
                        type="number"
                        step="0.01"
                        value={form.discount_amount}
                        onChange={(e) => updateForm('discount_amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-right font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Total
                      </label>
                      <div className="rounded-lg border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-right font-mono font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(computedTotal)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="notes"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => updateForm('notes', e.target.value)}
                      placeholder="Additional notes..."
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions - Full Width Below */}
        <form onSubmit={handleSubmit}>
          <div className="mt-4 flex items-center justify-end gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-6 py-4">
            <Button
              color="gray"
              size="sm"
              onClick={() => router.push('/dashboard/purchases/bills')}
              disabled={createBill.isPending}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" color="purple" size="sm" disabled={createBill.isPending}>
              {createBill.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <HiOutlineCheckCircle className="h-4 w-4 mr-2" />
                  Create Bill
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
