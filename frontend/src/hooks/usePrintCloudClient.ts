/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface PrintCloudPrinter {
  name: string;
  driver: string;
  printer_type: 'standard' | 'pos';
  status: 'online' | 'offline' | 'error' | 'busy';
  capabilities: Record<string, any>;
  last_status_update: string;
  client_name: string;
  client_id: string;
}

export interface PrintCloudClient {
  id: string;
  name: string;
  ip_address: string;
  status: 'online' | 'offline' | 'error';
  version: string;
  last_heartbeat: string;
  printer_counts: {
    total: number;
    online: number;
    standard: number;
    pos: number;
  };
}

interface PrintersResponse {
  printers_by_type: {
    standard: PrintCloudPrinter[];
    pos: PrintCloudPrinter[];
  };
  total_count: number;
  clients_online: number;
}

interface ClientsResponse {
  clients: PrintCloudClient[];
  total_clients: number;
}

export function usePrintCloudClient() {
  const [printers, setPrinters] = useState<PrintCloudPrinter[]>([]);
  const [clients, setClients] = useState<PrintCloudClient[]>([]);
  const [clientsOnline, setClientsOnline] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consider PrintCloudClient available only when at least one client is online
  const isAvailable = clientsOnline > 0;

  // Fetch available printers from all online PrintCloudClient instances
  const fetchPrinters = async (options: { forceRefresh?: boolean } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<PrintersResponse>('/printcloudclient/printers/available/', {
        params: options.forceRefresh ? { force_refresh: '1' } : undefined,
      });
      const { printers_by_type, clients_online } = response.data;

      // Combine all printers from both types
      const allPrinters = [...printers_by_type.standard, ...printers_by_type.pos];

      setPrinters(allPrinters);
      setClientsOnline(clients_online ?? 0);
      return allPrinters;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch printers';
      setPrinters([]);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch online PrintCloudClient instances
  const fetchClients = async (options: { forceRefresh?: boolean } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<ClientsResponse>('/printcloudclient/clients/', {
        params: options.forceRefresh ? { force_refresh: '1' } : undefined,
      });
      setClients(response.data.clients);
      setClientsOnline(response.data.clients.length);
      return response.data.clients;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get printers filtered by type
  const getPrintersByType = (type: 'standard' | 'pos'): PrintCloudPrinter[] => {
    return printers.filter((printer) => printer.printer_type === type);
  };

  // Get online printers only
  const getOnlinePrinters = (): PrintCloudPrinter[] => {
    return printers.filter((printer) => printer.status === 'online');
  };

  // Format printers for dropdown selection (compatible with existing electron format)
  const getFormattedPrinters = () => {
    return printers.map((printer) => ({
      name: printer.name,
      displayName: `${printer.name} (${printer.client_name})`,
      status: printer.status === 'online' ? 1 : 0, // Convert to number for compatibility
      isDefault: false, // PrintCloudClient doesn't have default concept per se
      printer_type: printer.printer_type,
      client_name: printer.client_name,
      client_id: printer.client_id,
    }));
  };

  // Send print job via API (different from electron - uses the Django API)
  const createPrintJob = async (documentType: string, printData: string, copies: number = 1) => {
    try {
      const response = await api.post('/printcloudclient/print/', {
        document_type: documentType,
        print_data: printData,
        copies,
      });

      return { success: true, jobId: response.data.id };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create print job';
      throw new Error(errorMessage);
    }
  };

  // Check if PrintCloud clients are available for printing
  const checkClientAvailability = async (documentType: string = 'quotation') => {
    try {
      const response = await api.post('/printcloudclient/check-availability/', {
        document_type: documentType,
      });

      return response.data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to check client availability';
      throw new Error(errorMessage);
    }
  };

  // Open browser fallback for printing
  const openBrowserFallback = (documentType: string, documentId: string) => {
    const fallbackUrl = `/api/printcloudclient/browser-print/${documentType}/${documentId}/`;
    return window.open(fallbackUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
  };

  // Auto-fetch printers on mount
  useEffect(() => {
    fetchPrinters();
  }, []);

  return {
    // Compatibility with useElectronPrinter interface
    isElectron: false, // This is PrintCloudClient, not Electron
    printers: getFormattedPrinters(), // Formatted for dropdown compatibility
    loading,
    error,
    fetchPrinters,

    // PrintCloudClient specific features
    isAvailable,
    clients,
    clientsOnline,
    fetchClients,
    getPrintersByType,
    getOnlinePrinters,
    createPrintJob,

    // Browser fallback features
    checkClientAvailability,
    openBrowserFallback,

    // Raw data
    rawPrinters: printers,
    printersCount: {
      total: printers.length,
      online: getOnlinePrinters().length,
      standard: getPrintersByType('standard').length,
      pos: getPrintersByType('pos').length,
    },
  };
}
