'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Spinner, Card } from 'flowbite-react';
import {
  HiOutlineArrowLeft,
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineUpload,
  HiOutlineExclamationCircle,
  HiOutlinePencil,
  HiOutlineRefresh,
} from 'react-icons/hi';
import {
  useCreateSupplierBill,
  useSuppliers,
  useUploadBillScan,
  useBillScan,
  useUpdateBillScan,
  useCreateBillFromScan,
} from '@/hooks/useSuppliers';
import type { BillScanExtractedData } from '@/types/suppliers';

type EntryMode = 'manual' | 'scan';

export default function NewSupplierBillPage() {
  const router = useRouter();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers({ is_active: true });

  // Entry mode selection
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');

  // Scan mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [billScanId, setBillScanId] = useState<number | null>(null);

  // Mutations
  const uploadScan = useUploadBillScan();
  const { data: billScan, isLoading: scanLoading } = useBillScan(billScanId);
  const updateScan = useUpdateBillScan();
  const createBill = useCreateSupplierBill();
  const createFromScan = useCreateBillFromScan();

  // Manual entry form state
  const [manualForm, setManualForm] = useState({
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

  // Scan mode form (populated from AI extraction)
  const [scanForm, setScanForm] = useState({
    internal_reference: '',
    bill_number: '',
    supplier: '',
    bill_date: '',
    due_date: '',
    subtotal: '',
    tax_amount: '',
    discount_amount: '',
    notes: '',
  });

  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert('File too large. Maximum size is 100MB.');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload PDF, JPG, or PNG.');
      return;
    }

    setSelectedFile(file);

    // Upload immediately
    try {
      const result = await uploadScan.mutateAsync(file);
      setBillScanId(result.id);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to upload file');
    }
  };

  // Populate form from AI extraction
  useEffect(() => {
    if (billScan?.processing_status === 'completed' && billScan.extracted_data) {
      const data = billScan.extracted_data;

      setScanForm({
        internal_reference: '', // User must provide
        bill_number: data.bill_number?.value || '',
        supplier: billScan.matched_supplier?.toString() || '',
        bill_date: data.bill_date?.value || '',
        due_date: data.due_date?.value || '',
        subtotal: data.subtotal?.value || '',
        tax_amount: data.tax_amount?.value || '0',
        discount_amount: data.discount_amount?.value || '0',
        notes: '',
      });
    }
  }, [billScan]);

  // Track field edits
  const handleScanFieldEdit = (field: string, value: string) => {
    setScanForm((prev) => ({ ...prev, [field]: value }));
    setEditedFields((prev) => ({ ...prev, [field]: true }));
  };

  // Get confidence for a field
  const getFieldConfidence = (field: keyof BillScanExtractedData): number => {
    return billScan?.extracted_data?.[field]?.confidence || 0;
  };

  // Confidence indicator component
  const ConfidenceIndicator = ({ confidence, edited }: { confidence: number; edited: boolean }) => {
    if (edited) {
      return (
        <Badge color="info" icon={HiOutlinePencil}>
          Edited
        </Badge>
      );
    }

    if (confidence >= 0.85) {
      return <Badge color="success">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else if (confidence >= 0.70) {
      return <Badge color="warning">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else {
      return <Badge color="failure">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
  };

  const handleSubmitFromScan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!billScanId) return;

    // Validation
    if (!scanForm.internal_reference || !scanForm.bill_number || !scanForm.supplier) {
      alert('Internal reference, bill number, and supplier are required.');
      return;
    }

    try {
      // Calculate total
      const subtotal = parseFloat(scanForm.subtotal || '0');
      const tax = parseFloat(scanForm.tax_amount || '0');
      const discount = parseFloat(scanForm.discount_amount || '0');
      const total = subtotal + tax - discount;

      // Update scan with edited fields
      await updateScan.mutateAsync({
        id: billScanId,
        data: {
          user_edited_fields: editedFields,
        },
      });

      // Create bill from scan
      const created = await createFromScan.mutateAsync({
        scanId: billScanId,
        billData: {
          ...scanForm,
          total: total.toFixed(2),
        },
      });

      alert('Supplier bill created successfully from scan.');
      router.push(`/dashboard/purchases/bills/${created.id}`);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to create bill');
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!manualForm.internal_reference || !manualForm.bill_number || !manualForm.supplier) {
      alert('Internal reference, bill number, and supplier are required.');
      return;
    }

    try {
      const subtotal = parseFloat(manualForm.subtotal || '0');
      const tax = parseFloat(manualForm.tax_amount || '0');
      const discount = parseFloat(manualForm.discount_amount || '0');
      const total = subtotal + tax - discount;

      const created = await createBill.mutateAsync({
        ...manualForm,
        tax_amount: tax.toFixed(2),
        discount_amount: discount.toFixed(2),
      });

      alert('Supplier bill created successfully.');
      router.push(`/dashboard/purchases/bills/${created.id}`);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to create bill');
    }
  };

  const computedTotal = useMemo(() => {
    const activeForm = entryMode === 'scan' ? scanForm : manualForm;
    const subtotal = parseFloat(activeForm.subtotal || '0');
    const tax = parseFloat(activeForm.tax_amount || '0');
    const discount = parseFloat(activeForm.discount_amount || '0');
    return subtotal + tax - discount;
  }, [entryMode, manualForm, scanForm]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/purchases/bills')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <HiOutlineArrowLeft className="h-4 w-4" />
            Back to Bills
          </button>

          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <HiOutlineDocumentText className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Supplier Bill</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Record a supplier invoice manually or scan with AI
              </p>
            </div>
          </div>
        </div>

        {/* Entry Mode Toggle */}
        <div className="mb-6 flex gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setEntryMode('manual')}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              entryMode === 'manual'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setEntryMode('scan')}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              entryMode === 'scan'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <HiOutlineUpload className="h-4 w-4" />
              Scan & Extract (AI)
            </div>
          </button>
        </div>

        {/* Scan Mode */}
        {entryMode === 'scan' && (
          <div className="flex flex-col gap-6 xl:flex-row">
            {/* Left: Document Viewer */}
            <div className="min-w-0 flex-1">
              <Card>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scanned Document</h2>
                </div>
                <div className="pt-6">
                  {!selectedFile && (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-20 dark:border-gray-600">
                      <HiOutlineUpload className="mb-4 h-16 w-16 text-gray-400" />
                      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                        Upload bill scan (PDF, JPG, PNG)
                      </p>
                      <label className="cursor-pointer rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                        Select File
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/jpg,image/png"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {selectedFile && (
                    <div>
                      {/* Processing Status */}
                      {billScan && (
                        <div className="mb-4">
                          {billScan.processing_status === 'pending' && (
                            <Badge color="gray" icon={HiOutlineRefresh}>
                              Pending Processing
                            </Badge>
                          )}
                          {billScan.processing_status === 'processing' && (
                            <Badge color="info" icon={Spinner}>
                              Processing with AI...
                            </Badge>
                          )}
                          {billScan.processing_status === 'completed' && (
                            <Badge color="success" icon={HiOutlineCheckCircle}>
                              Extraction Complete
                            </Badge>
                          )}
                          {billScan.processing_status === 'failed' && (
                            <Badge color="failure" icon={HiOutlineExclamationCircle}>
                              Processing Failed: {billScan.processing_error}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Document Preview */}
                      {billScan?.file_url && (
                        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                          {billScan.file_type === 'application/pdf' ? (
                            <iframe
                              src={billScan.file_url}
                              className="h-[800px] w-full"
                              title="Bill Scan"
                            />
                          ) : (
                            <img src={billScan.file_url} alt="Bill Scan" className="w-full" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right: Extracted Data Form */}
            <div className="w-full flex-shrink-0 xl:w-[480px]">
              <form onSubmit={handleSubmitFromScan}>
                <Card>
                  <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Extracted Data</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Review and edit AI-extracted information
                    </p>
                  </div>
                  <div className="space-y-4 pt-6">
                    {billScan?.processing_status === 'completed' ? (
                      <>
                        {/* Supplier Match */}
                        {billScan.matched_supplier && (
                          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900">
                            <div className="flex items-center gap-2">
                              <HiOutlineCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <div>
                                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                  Supplier Matched: {billScan.matched_supplier_name}
                                </p>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                  Confidence: {((billScan.supplier_match_confidence || 0) * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Internal Reference (required, no AI) */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Internal Reference *
                          </label>
                          <input
                            type="text"
                            value={scanForm.internal_reference}
                            onChange={(e) => handleScanFieldEdit('internal_reference', e.target.value)}
                            placeholder="e.g., BILL-2026-001"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            required
                          />
                        </div>

                        {/* Bill Number (AI extracted) */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Bill Number *
                            </label>
                            <ConfidenceIndicator
                              confidence={getFieldConfidence('bill_number')}
                              edited={editedFields.bill_number || false}
                            />
                          </div>
                          <input
                            type="text"
                            value={scanForm.bill_number}
                            onChange={(e) => handleScanFieldEdit('bill_number', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            required
                          />
                        </div>

                        {/* Supplier (AI matched) */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Supplier *
                            </label>
                            {billScan.matched_supplier && <Badge color="success">Auto-matched</Badge>}
                          </div>
                          <select
                            value={scanForm.supplier}
                            onChange={(e) => handleScanFieldEdit('supplier', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            required
                          >
                            <option value="">Select supplier</option>
                            {suppliers?.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Bill Date
                              </label>
                              <ConfidenceIndicator
                                confidence={getFieldConfidence('bill_date')}
                                edited={editedFields.bill_date || false}
                              />
                            </div>
                            <input
                              type="date"
                              value={scanForm.bill_date}
                              onChange={(e) => handleScanFieldEdit('bill_date', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Due Date
                              </label>
                              <ConfidenceIndicator
                                confidence={getFieldConfidence('due_date')}
                                edited={editedFields.due_date || false}
                              />
                            </div>
                            <input
                              type="date"
                              value={scanForm.due_date}
                              onChange={(e) => handleScanFieldEdit('due_date', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Amounts */}
                        <div className="space-y-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Subtotal
                              </label>
                              <ConfidenceIndicator
                                confidence={getFieldConfidence('subtotal')}
                                edited={editedFields.subtotal || false}
                              />
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={scanForm.subtotal}
                              onChange={(e) => handleScanFieldEdit('subtotal', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Tax Amount
                              </label>
                              <ConfidenceIndicator
                                confidence={getFieldConfidence('tax_amount')}
                                edited={editedFields.tax_amount || false}
                              />
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={scanForm.tax_amount}
                              onChange={(e) => handleScanFieldEdit('tax_amount', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Discount
                              </label>
                              <ConfidenceIndicator
                                confidence={getFieldConfidence('discount_amount')}
                                edited={editedFields.discount_amount || false}
                              />
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={scanForm.discount_amount}
                              onChange={(e) => handleScanFieldEdit('discount_amount', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>

                          {/* Total (calculated) */}
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Total
                            </label>
                            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-right text-lg font-mono font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              {computedTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Notes
                          </label>
                          <textarea
                            rows={3}
                            value={scanForm.notes}
                            onChange={(e) => handleScanFieldEdit('notes', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>

                        {/* Submit */}
                        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                          <button
                            type="submit"
                            disabled={createFromScan.isPending}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {createFromScan.isPending ? (
                              <>
                                <Spinner size="sm" />
                                Creating Bill...
                              </>
                            ) : (
                              <>
                                <HiOutlineCheckCircle className="h-5 w-5" />
                                Create Bill from Scan
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        {billScan?.processing_status === 'processing' ||
                        billScan?.processing_status === 'pending' ? (
                          <>
                            <Spinner size="xl" className="mb-4" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              AI is extracting data from your document...
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Upload a document to extract data
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </form>
            </div>
          </div>
        )}

        {/* Manual Mode */}
        {entryMode === 'manual' && (
          <form onSubmit={handleSubmitManual} className="mx-auto max-w-3xl space-y-6">
            {/* Bill References */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bill References</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Internal Reference *
                  </label>
                  <input
                    type="text"
                    value={manualForm.internal_reference}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, internal_reference: e.target.value }))
                    }
                    placeholder="e.g., BILL-2026-001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Supplier Bill Number *
                  </label>
                  <input
                    type="text"
                    value={manualForm.bill_number}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, bill_number: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Supplier *
                  </label>
                  <select
                    value={manualForm.supplier}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, supplier: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers?.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* Bill Dates */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bill Dates</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    value={manualForm.bill_date}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, bill_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={manualForm.due_date}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, due_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </Card>

            {/* Bill Amounts */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bill Amounts</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subtotal *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualForm.subtotal}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, subtotal: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tax Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualForm.tax_amount}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, tax_amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualForm.discount_amount}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total
                  </label>
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-lg font-mono font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    {computedTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Additional Information */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Additional Information
              </h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={manualForm.notes}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard/purchases/bills')}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createBill.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createBill.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Creating...
                  </>
                ) : (
                  <>
                    <HiOutlineCheckCircle className="h-5 w-5" />
                    Create Bill
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
