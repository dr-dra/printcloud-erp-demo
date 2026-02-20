import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePrintCloudClient } from './usePrintCloudClient';
import { api } from '@/lib/api';

interface PrintQuotationOptions {
  quotationId: string | number;
  printerName?: string;
  showDialog?: boolean;
}

export function useQuotationPrint() {
  const { user: _user } = useAuth();
  const { isAvailable: clientsAvailable } = usePrintCloudClient();
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printQuotation = async ({
    quotationId,
    printerName: _printerName,
    showDialog: _showDialog = false,
  }: PrintQuotationOptions) => {
    try {
      setPrinting(true);
      setError(null);

      if (!clientsAvailable) {
        // Fallback for web browser when no PrintCloudClient available - open in new window for manual printing
        const response = await api.get(`/sales/quotations/${quotationId}/letterhead/`);
        const html = response.data;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();

          // Set up event listeners to close the window after printing
          const setupCloseHandlers = () => {
            let printCompleted = false;

            // Close window after successful print
            printWindow.addEventListener('afterprint', () => {
              printCompleted = true;
              setTimeout(() => printWindow.close(), 100);
            });

            // Monitor print dialog state by checking focus
            const checkPrintDialog = () => {
              let dialogOpen = false;

              printWindow.addEventListener('blur', () => {
                dialogOpen = true;
              });

              printWindow.addEventListener('focus', () => {
                if (dialogOpen && !printCompleted) {
                  setTimeout(() => {
                    if (!printWindow.closed) {
                      printWindow.close();
                    }
                  }, 500);
                }
              });

              setTimeout(() => {
                if (!printCompleted && !printWindow.closed) {
                  printWindow.close();
                }
              }, 1000);
            };

            setTimeout(checkPrintDialog, 100);

            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 10000);
          };

          setTimeout(setupCloseHandlers, 100);
          printWindow.print();
        } else {
          throw new Error('Unable to open print window. Please allow pop-ups and try again.');
        }
        return { success: true };
      }

      // Use PrintCloudClient via Celery - create print job using new endpoint
      const response = await api.post(`/sales/quotations/${quotationId}/print/`);

      if (response.data.success) {
        // Print job queued successfully and will be processed by PrintCloudClient
        return {
          success: true,
          taskId: response.data.task_id,
          quotationNumber: response.data.quotation_number,
          message: response.data.message,
        };
      } else {
        throw new Error('Failed to queue print job');
      }
    } catch (err: unknown) {
      let errorMessage = 'Print failed';
      const axiosError = err as { response?: { data?: { error?: string } } };
      if (axiosError.response?.data?.error) {
        errorMessage = axiosError.response.data.error;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setPrinting(false);
    }
  };

  const printQuotationToPDF = async (quotationId: string | number) => {
    try {
      setPrinting(true);
      setError(null);

      // Download PDF as before
      const response = await api.get(`/sales/quotations/${quotationId}/pdf/`, {
        responseType: 'blob',
      });

      // Create blob link to download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Quotation-${quotationId}.pdf`);
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PDF download failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setPrinting(false);
    }
  };

  return {
    printQuotation,
    printQuotationToPDF,
    printing,
    error,
    clientsAvailable,
  };
}
