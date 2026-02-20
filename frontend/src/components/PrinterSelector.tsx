'use client';

import React from 'react';
import { Label, Alert } from 'flowbite-react';
import { HiInformationCircle } from 'react-icons/hi';
import { HiExclamationTriangle } from 'react-icons/hi2';
import { BsPrinter, BsPrinterFill } from 'react-icons/bs';

interface Printer {
  id: string;
  name: string;
  printer_type: 'standard' | 'pos';
  status: 'online' | 'offline' | 'error' | 'busy';
  driver?: string;
  client_name: string;
  similarity_score?: number;
}

interface PrinterSelectorProps {
  printers: Printer[];
  selectedPrinter: string | null;
  onPrinterChange: (printerName: string) => void;
  defaultPrinterOffline?: boolean;
}

const PrinterSelector: React.FC<PrinterSelectorProps> = ({
  printers,
  selectedPrinter,
  onPrinterChange,
  defaultPrinterOffline = false,
}) => {
  // Get status badge color and text
  const getStatusBadge = (status: Printer['status']) => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          text: 'Online',
        };
      case 'offline':
        return {
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
          text: 'Offline',
        };
      case 'error':
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
          text: 'Error',
        };
      case 'busy':
        return {
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
          text: 'Busy',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
          text: 'Unknown',
        };
    }
  };

  // Get printer type display
  const getPrinterTypeDisplay = (type: Printer['printer_type']) => {
    switch (type) {
      case 'standard':
        return 'Standard Printer';
      case 'pos':
        return 'POS/Thermal Printer';
      default:
        return 'Unknown Type';
    }
  };

  // Get similarity score display
  const getSimilarityDisplay = (score?: number) => {
    if (!score) return null;

    if (score >= 90)
      return { text: 'Excellent Match', color: 'text-green-600 dark:text-green-400' };
    if (score >= 70) return { text: 'Good Match', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 50) return { text: 'Fair Match', color: 'text-yellow-600 dark:text-yellow-400' };
    return { text: 'Poor Match', color: 'text-red-600 dark:text-red-400' };
  };

  // Sort printers by similarity score (highest first) and status
  const sortedPrinters = [...printers].sort((a, b) => {
    // First, prioritize online printers
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (b.status === 'online' && a.status !== 'online') return 1;

    // Then by similarity score
    const scoreA = a.similarity_score || 0;
    const scoreB = b.similarity_score || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // Finally by name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      {/* Information Alert */}
      {defaultPrinterOffline && (
        <Alert color="warning" icon={HiExclamationTriangle}>
          <span className="font-medium">Default printer is offline.</span> Please select an
          alternative printer from the list below.
        </Alert>
      )}

      {/* Instructions */}
      {!defaultPrinterOffline && (
        <Alert color="info" icon={HiInformationCircle}>
          <span className="font-medium">Select a printer</span> to continue with your print job.
        </Alert>
      )}

      {/* Printer Selection */}
      <div>
        <Label htmlFor="printer-select" value="Available Printers:" className="mb-2 block" />

        {sortedPrinters.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BsPrinter className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No compatible printers available</p>
            <p className="text-sm">Please ensure at least one printer is online</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPrinters.map((printer) => {
              const statusBadge = getStatusBadge(printer.status);
              const similarityDisplay = getSimilarityDisplay(printer.similarity_score);
              const isSelected = selectedPrinter === printer.name;
              const isOnline = printer.status === 'online';

              return (
                <div
                  key={printer.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-opacity-50'
                      : isOnline
                        ? 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                        : 'border-gray-200 dark:border-gray-700 opacity-60'
                  } ${!isOnline ? 'cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (isOnline) {
                      onPrinterChange(printer.name);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Radio button */}
                      <div className="flex items-center pt-1">
                        <input
                          type="radio"
                          name="printer-selection"
                          value={printer.name}
                          checked={isSelected}
                          onChange={() => {
                            if (isOnline) {
                              onPrinterChange(printer.name);
                            }
                          }}
                          disabled={!isOnline}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>

                      {/* Printer icon */}
                      <div className="flex items-center pt-1">
                        {printer.printer_type === 'pos' ? (
                          <BsPrinterFill className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <BsPrinter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </div>

                      {/* Printer details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {printer.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>{getPrinterTypeDisplay(printer.printer_type)}</div>
                          {printer.driver && (
                            <div className="truncate">Driver: {printer.driver}</div>
                          )}
                          <div>Client: {printer.client_name}</div>
                          {similarityDisplay && (
                            <div className={`font-medium ${similarityDisplay.color}`}>
                              {similarityDisplay.text}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.color}`}
                      >
                        {statusBadge.text}
                      </span>
                    </div>
                  </div>

                  {/* Best match indicator */}
                  {printer.similarity_score && printer.similarity_score >= 90 && (
                    <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                      ⭐ Recommended based on your preferences
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• Only online printers are selectable</p>
        <p>• Printers are ranked by compatibility with your default printer</p>
        <p>• Document size and printer type preferences are considered</p>
      </div>
    </div>
  );
};

export default PrinterSelector;
