'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert, Label } from 'flowbite-react';
import { HiPrinter, HiCheckCircle } from 'react-icons/hi';
import { BsPrinter, BsExclamationTriangle } from 'react-icons/bs';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { getErrorMessage } from '@/utils/errorHandling';
import PrinterSelector from './PrinterSelector';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType:
    | 'quotation'
    | 'invoice'
    | 'order'
    | 'purchase_order'
    | 'receipt'
    | 'order_receipt'
    | 'job_ticket'
    | 'dispatch_note'
    | 'credit_note';
  documentId: string;
  documentTitle: string;
  copies?: number;
  onSendComplete?: (result: {
    success: boolean;
    method: 'print';
    destination: string;
    error?: string;
  }) => void;
}

interface PrintJob {
  id: string;
  status: 'pending' | 'assigned' | 'printing' | 'completed' | 'failed';
  error_message?: string;
  used_printer_name?: string;
  created_at: string;
  completed_at?: string;
}

interface Printer {
  id: string;
  name: string;
  printer_type: 'standard' | 'pos';
  status: 'online' | 'offline' | 'error' | 'busy';
  driver?: string;
  client_name: string;
  similarity_score?: number;
}

type PrintStatus =
  | 'preparing'
  | 'checking_printer'
  | 'printer_selection'
  | 'printing'
  | 'completed'
  | 'failed';

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentTitle,
  copies = 1,
  onSendComplete,
}) => {
  const isReceipt = documentType === 'receipt' || documentType === 'order_receipt';
  const availabilityDocumentType = isReceipt ? 'receipt' : documentType;
  const [status, setStatus] = useState<PrintStatus>('preparing');
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [printCopies, setPrintCopies] = useState(copies);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [statusPollingInterval, setStatusPollingInterval] = useState<ReturnType<
    typeof setInterval
  > | null>(null);
  const [showPrinterSelection, setShowPrinterSelection] = useState(false);
  const [defaultPrinterOffline, setDefaultPrinterOffline] = useState(false);
  const [showBrowserFallback, setShowBrowserFallback] = useState(false);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
      }
    };
  }, [statusPollingInterval]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('preparing');
      setPrintJob(null);
      setAvailablePrinters([]);
      setSelectedPrinter(null);
      setPrintCopies(copies);
      setErrorMessage(null);
      setRetryCount(0);
      setShowPrinterSelection(false);
      setDefaultPrinterOffline(false);
      setShowBrowserFallback(false);

      // Start the printing process
      startPrintProcess();
    } else {
      // Clean up when modal closes
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        setStatusPollingInterval(null);
      }
    }
  }, [isOpen, copies]);

  // Start the complete printing process
  const startPrintProcess = async () => {
    try {
      setStatus('checking_printer');

      // First check if any PrintCloud clients are available
      console.log('Checking PrintCloud client availability...');
      const clientAvailability = await checkClientAvailability();
      console.log('Client availability check result:', clientAvailability);

      if (!clientAvailability.clients_online || clientAvailability.should_use_fallback) {
        console.log('No PrintCloud clients available, showing browser fallback...');
        setShowBrowserFallback(true);
        setStatus('failed');
        setErrorMessage(
          clientAvailability.fallback_reason ||
            'No PrintCloud clients are currently online. Use browser printing as fallback.',
        );
        return;
      }

      // Check printer availability
      console.log('Checking printer availability...');
      const printerCheck = await checkPrinterAvailability();
      console.log('Printer check result:', printerCheck);

      if (printerCheck.defaultPrinterAvailable) {
        // Default printer is available, proceed with printing
        console.log('Default printer available, creating print job...');
        await createPrintJob(null);
      } else {
        console.log('Default printer offline, showing printer selection...');
        // Default printer is offline, show printer selection
        setAvailablePrinters(printerCheck.availablePrinters);
        setDefaultPrinterOffline(true);

        if (printerCheck.availablePrinters.length === 0) {
          // No compatible printers available
          console.log('No compatible printers available');
          if (
            isReceipt ||
            (printerCheck.requiredPrinterType === 'pos' &&
              printerCheck.availablePrinters.length === 0)
          ) {
            setStatus('failed');
            setErrorMessage(
              'No compatible POS/thermal printers found. Please ensure at least one POS printer is online.',
            );
          } else {
            setStatus('failed');
            setErrorMessage(
              'No compatible printers found. Please ensure at least one printer is online.',
            );
          }
        } else {
          // Show printer selection with auto-selected best match
          console.log(`Found ${printerCheck.availablePrinters.length} alternative printers`);
          const bestMatch = printerCheck.availablePrinters[0]; // Already sorted by similarity
          setSelectedPrinter(bestMatch.name);
          setStatus('printer_selection');
          setShowPrinterSelection(true);
        }
      }
    } catch (error) {
      console.error('Error in print process:', error);
      setStatus('failed');
      setErrorMessage(getErrorMessage(error as any));
    }
  };

  // Check PrintCloud client availability
  const checkClientAvailability = async (): Promise<{
    clients_online: number;
    compatible_printers_available: number;
    should_use_fallback: boolean;
    fallback_reason: string | null;
  }> => {
    try {
      const response = await api.post(`/printcloudclient/check-availability/`, {
        document_type: availabilityDocumentType,
        force_refresh: true,
      });

      return response.data;
    } catch (error) {
      console.error('Error checking client availability:', error);
      // If we can't check, assume fallback is needed
      return {
        clients_online: 0,
        compatible_printers_available: 0,
        should_use_fallback: true,
        fallback_reason: 'Unable to connect to PrintCloud service',
      };
    }
  };

  // Check printer availability and get alternatives
  const checkPrinterAvailability = async (): Promise<{
    defaultPrinterAvailable: boolean;
    availablePrinters: Printer[];
    requiredPrinterType: string;
  }> => {
    try {
      const response = await api.get(`/printcloudclient/printers/check-availability/`, {
        params: {
          document_type: availabilityDocumentType,
          force_refresh: '1',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error checking printer availability:', error);
      throw new Error('Failed to check printer availability');
    }
  };

  // Create print job with optional printer override
  const createPrintJob = async (printerName: string | null) => {
    try {
      console.log(
        `Creating print job for ${documentType} ${documentId} with printer:`,
        printerName,
      );
      setStatus('printing');
      setErrorMessage(null);

      // Dynamic endpoint based on document type
      const endpoint = isReceipt
        ? documentType === 'order_receipt'
          ? `/sales/orders/payments/${documentId}/receipt/print/`
          : `/sales/invoices/payments/${documentId}/receipt/print/`
        : documentType === 'credit_note'
          ? `/sales/invoices/credit-notes/${documentId}/print/`
        : documentType === 'purchase_order'
          ? `/purchases/orders/${documentId}/print/`
          : documentType === 'order'
            ? `/sales/orders/${documentId}/print/`
            : `/sales/${documentType}s/${documentId}/print/`;

      const response = await api.post(endpoint, {
        printer_name: printerName,
        copies: printCopies,
      });

      console.log('Print job response:', response.data);
      const jobId = response.data.print_job_id;

      if (jobId) {
        // Start polling for job status immediately
        console.log('Got print job ID:', jobId, 'starting polling...');
        startStatusPolling(jobId);
      } else {
        // Fallback: use task ID or show success message for older API
        console.log('No print job ID, using fallback success message');
        // Print job queued - no notification needed

        // Auto-close modal after 2 seconds for fallback case
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error creating print job:', error);
      setStatus('failed');
      setErrorMessage(getErrorMessage(error as any));
    }
  };

  // Start polling for print job status
  const startStatusPolling = (jobId: string) => {
    const pollStatus = async () => {
      try {
        const response = await api.get(`/printcloudclient/printjobs/${jobId}/status/`);
        const job: PrintJob = response.data;

        setPrintJob(job);

        if (job.status === 'completed') {
          setStatus('completed');
          stopStatusPolling();

          // Notify parent of successful print
          onSendComplete?.({
            success: true,
            method: 'print',
            destination: job.used_printer_name || 'Unknown Printer',
          });

          // Auto-close modal after 2 seconds
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (job.status === 'failed') {
          setStatus('failed');
          setErrorMessage(job.error_message || 'Print job failed');
          stopStatusPolling();

          // Notify parent of failed print
          onSendComplete?.({
            success: false,
            method: 'print',
            destination: job.used_printer_name || 'Unknown Printer',
            error: job.error_message || 'Print job failed',
          });
        }
        // Continue polling for pending, assigned, printing states
      } catch (error) {
        console.error('Error polling job status:', error);
        setStatus('failed');
        setErrorMessage('Lost connection to print service');
        stopStatusPolling();
      }
    };

    // Start polling every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    setStatusPollingInterval(interval);

    // Call immediately for first status check
    pollStatus();
  };

  // Stop status polling
  const stopStatusPolling = () => {
    if (statusPollingInterval) {
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
    }
  };

  // Handle browser fallback printing
  const handleBrowserFallback = async () => {
    try {
      console.log('Opening browser fallback print page...');

      // Open the browser print fallback URL in a new tab
      const token = getToken();
      const tokenQuery = token ? `?access_token=${encodeURIComponent(token)}` : '';
      const fallbackUrl = `/api/printcloudclient/browser-print/${documentType}/${documentId}/${tokenQuery}`;
      const printWindow = window.open(
        fallbackUrl,
        '_blank',
        'width=800,height=600,scrollbars=yes,resizable=yes',
      );

      if (printWindow) {
        // Focus the new window
        printWindow.focus();

        // Show success message
        // Browser print page opened - no notification needed

        // Close the modal
        onClose();
      } else {
        // Popup was blocked, show alternative
        console.warn('Popup blocked - user needs to allow popups');
      }
    } catch (error) {
      console.error('Error opening browser fallback:', error);
    }
  };

  // Handle printer selection and proceed with printing
  const handlePrinterSelection = async () => {
    if (!selectedPrinter) {
      setErrorMessage('Please select a printer');
      return;
    }

    setShowPrinterSelection(false);
    await createPrintJob(selectedPrinter);
  };

  // Handle retry print
  const handleRetry = async () => {
    setRetryCount((prev) => prev + 1);
    setErrorMessage(null);
    await startPrintProcess();
  };

  // Get status display information
  const getStatusInfo = () => {
    switch (status) {
      case 'preparing':
        return {
          icon: <Spinner className="w-6 h-6" />,
          title: 'Preparing print job...',
          description: 'Setting up your document for printing',
          color: 'blue' as const,
        };
      case 'checking_printer':
        return {
          icon: <Spinner className="w-6 h-6" />,
          title: 'Checking printer availability...',
          description: 'Verifying your default printer is online',
          color: 'blue' as const,
        };
      case 'printer_selection':
        return {
          icon: <BsExclamationTriangle className="w-6 h-6 text-yellow-500" />,
          title: 'Printer Selection Required',
          description: defaultPrinterOffline
            ? 'Your default printer is offline. Please select an alternative.'
            : 'Please select a printer for this document.',
          color: 'warning' as const,
        };
      case 'printing':
        return {
          icon: <Spinner className="w-6 h-6" />,
          title: 'Printing...',
          description: printJob?.used_printer_name
            ? `Sending to ${printJob.used_printer_name}`
            : 'Sending document to printer',
          color: 'blue' as const,
        };
      case 'completed':
        return {
          icon: <HiCheckCircle className="w-6 h-6 text-green-500" />,
          title: 'Print Completed Successfully',
          description: printJob?.used_printer_name
            ? `Printed to ${printJob.used_printer_name}`
            : 'Your document has been sent to the printer',
          color: 'success' as const,
        };
      case 'failed':
        return {
          icon: <BsExclamationTriangle className="w-6 h-6 text-red-500" />,
          title: 'Print Failed',
          description: errorMessage || 'An error occurred while printing',
          color: 'failure' as const,
        };
      default:
        return {
          icon: <HiPrinter className="w-6 h-6" />,
          title: 'Print Status',
          description: 'Processing...',
          color: 'blue' as const,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Modal show={isOpen} onClose={onClose} size="lg" className="print-modal">
      <Modal.Header className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <BsPrinter className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Print {documentTitle}
          </h3>
        </div>
      </Modal.Header>

      <Modal.Body className="p-6">
        <div className="space-y-6">
          {/* Status Display */}
          <div className="text-center">
            <div className="flex justify-center mb-4">{statusInfo.icon}</div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {statusInfo.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{statusInfo.description}</p>
          </div>

          {/* Error Alert */}
          {status === 'failed' && errorMessage && (
            <Alert color="failure" className="mb-4">
              <span className="font-medium">Print Error:</span> {errorMessage}
            </Alert>
          )}

          {/* Printer Selection */}
          {showPrinterSelection && (
            <div className="space-y-4">
              <PrinterSelector
                printers={availablePrinters}
                selectedPrinter={selectedPrinter}
                onPrinterChange={setSelectedPrinter}
                defaultPrinterOffline={defaultPrinterOffline}
              />

              {/* Copies selector for printer selection */}
              <div>
                <Label htmlFor="copies" value="Number of copies:" />
                <select
                  id="copies"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Number(e.target.value))}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 99 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'copy' : 'copies'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Print Job Progress */}
          {printJob && status === 'printing' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Spinner size="sm" />
                <div>
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    Job Status: {printJob.status.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-200">
                    Created: {new Date(printJob.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-end gap-3 w-full">
          {/* Show different actions based on status */}
          {status === 'failed' && (
            <>
              <Button color="gray" onClick={onClose}>
                Cancel
              </Button>
              {showBrowserFallback && (
                <Button
                  onClick={handleBrowserFallback}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <HiPrinter className="mr-2 h-4 w-4" />
                  Print with Browser
                </Button>
              )}
              <Button onClick={handleRetry} disabled={retryCount >= 3}>
                {retryCount >= 3
                  ? 'Max Retries Reached'
                  : `Retry${retryCount > 0 ? ` (${retryCount}/3)` : ''}`}
              </Button>
            </>
          )}

          {status === 'printer_selection' && (
            <>
              <Button color="gray" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePrinterSelection}
                disabled={!selectedPrinter}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Print to Selected Printer
              </Button>
            </>
          )}

          {status === 'completed' && (
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
              OK
            </Button>
          )}

          {(status === 'preparing' || status === 'checking_printer' || status === 'printing') && (
            <Button color="gray" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
};
