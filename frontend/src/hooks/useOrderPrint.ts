import { useState } from 'react';
import { ordersAPI } from '@/lib/api';

export function useOrderPrint() {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printOrderToPDF = async (orderId: string | number) => {
    try {
      setPrinting(true);
      setError(null);

      // Download PDF
      const response = await ordersAPI.getOrderPDF(parseInt(orderId.toString()));

      // Create blob link to download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Order-${orderId}.pdf`);
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
    printOrderToPDF,
    printing,
    error,
  };
}
