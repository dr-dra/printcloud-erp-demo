'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from 'flowbite-react';
import { Send as BsSend, Mail, MessageCircle } from 'lucide-react';
import type { SendCardProps, DocumentCommunicationLog } from '@/types/communications';
import {
  formatDisplayDate,
  formatRelativeTime,
  getCommunicationMethodLabel,
} from '@/utils/communications';
import { api } from '@/lib/api';

export default function SendCard({
  docType,
  docId,
  onEmail,
  onWhatsApp,
  onPrint,
  refreshTrigger,
  compact = false,
}: SendCardProps) {
  const [latestCommunication, setLatestCommunication] = useState<DocumentCommunicationLog | null>(
    null,
  );
  const [communicationCount, setCommunicationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [_polling, setPolling] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // eslint-disable-next-line no-undef
  const pollTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const lastCommIdRef = useRef<number | null>(null);

  // Polling intervals: 5s, 10s, 15s, 30s, 60s, 120s, 180s (total ~7 min)
  const POLL_INTERVALS = [5000, 10000, 15000, 30000, 60000, 120000, 180000];

  // Initial fetch on mount or when docType/docId changes
  useEffect(() => {
    fetchLatestCommunication();
  }, [docType, docId]);

  // Start polling when refreshTrigger changes (after send action)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      startPolling();
    }
  }, [refreshTrigger]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, []);

  const clearAllTimeouts = () => {
    pollTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pollTimeoutsRef.current = [];
  };

  const fetchLatestCommunication = async () => {
    try {
      setLoading(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await api.get<any>('/core/communication-logs/', {
        params: {
          doc_type: docType,
          doc_id: docId,
          success: true,
        },
      });

      const successfulComms = response.data.results || response.data || [];
      setCommunicationCount(successfulComms.length);

      if (successfulComms.length > 0) {
        setLatestCommunication(successfulComms[0]);
        lastCommIdRef.current = successfulComms[0].id;
      } else {
        setLatestCommunication(null);
        lastCommIdRef.current = null;
      }
    } catch {
      // Silently handle errors - leave as "Never sent"
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    // Clear any existing polling
    clearAllTimeouts();
    setPolling(true);

    // Store the initial communication ID before polling starts
    const initialCommId = lastCommIdRef.current;

    let cumulativeDelay = 0;

    POLL_INTERVALS.forEach((interval) => {
      cumulativeDelay += interval;

      const timeout = setTimeout(async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await api.get<any>('/core/communication-logs/', {
            params: {
              doc_type: docType,
              doc_id: docId,
              success: true,
            },
          });

          const successfulComms = response.data.results || response.data || [];

          // Check if there's a new communication
          if (successfulComms.length > 0) {
            const latestId = successfulComms[0].id;

            // New communication found - different ID from when polling started
            if (latestId !== initialCommId) {
              // Trigger fade out
              setIsTransitioning(true);

              // Wait for fade out (500ms), then update content and fade in (500ms)
              setTimeout(() => {
                setLatestCommunication(successfulComms[0]);
                setCommunicationCount(successfulComms.length);
                lastCommIdRef.current = latestId;

                // Trigger fade in immediately after content update
                requestAnimationFrame(() => {
                  setIsTransitioning(false);
                });
              }, 500);

              // Stop polling - we found the update
              clearAllTimeouts();
              setPolling(false);
            }
          }
        } catch {
          // Silently handle errors during polling
        }
      }, cumulativeDelay);

      pollTimeoutsRef.current.push(timeout);
    });

    // Stop polling after all intervals complete
    const finalTimeout = setTimeout(() => {
      setPolling(false);
    }, cumulativeDelay);
    pollTimeoutsRef.current.push(finalTimeout);
  };

  const renderCompactStatus = () => {
    if (loading) {
      return <span className="text-xs text-gray-400">Loading...</span>;
    }

    if (!latestCommunication) {
      return <span className="text-xs text-gray-500 dark:text-gray-400">Never sent</span>;
    }

    const relativeTime = formatRelativeTime(latestCommunication.sent_at);
    const method = getCommunicationMethodLabel(latestCommunication.method);

    if (!latestCommunication.success) {
      return <span className="text-xs text-red-500">Failed</span>;
    }

    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {method} • {relativeTime}
        {communicationCount > 1 && (
          <button
            onClick={() => setShowHistory(true)}
            className="ml-1 text-teal-600 dark:text-teal-400 hover:underline"
          >
            +{communicationCount - 1}
          </button>
        )}
      </span>
    );
  };

  const renderSendStatus = () => {
    if (loading) {
      return <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>;
    }

    if (!latestCommunication) {
      return <div className="text-sm text-gray-500 dark:text-gray-400">Never sent</div>;
    }

    const formattedDate = formatDisplayDate(latestCommunication.sent_at);
    const relativeTime = formatRelativeTime(latestCommunication.sent_at);
    const method = getCommunicationMethodLabel(latestCommunication.method);
    const sentBy = latestCommunication.sent_by_details.full_name;
    const destination = latestCommunication.destination;

    // Show failure status
    if (!latestCommunication.success) {
      return (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to send via {method} to {destination}
          {latestCommunication.error_message && (
            <span className="block mt-1 text-xs">Error: {latestCommunication.error_message}</span>
          )}
          {communicationCount > 1 && (
            <>
              {' '}
              <button
                onClick={() => setShowHistory(true)}
                className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
              >
                [More..]
              </button>
            </>
          )}
        </div>
      );
    }

    // Show success status
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Sent Via {method} on {formattedDate} ({relativeTime}) to {destination} by {sentBy}
        {communicationCount > 1 && (
          <>
            {' '}
            <button
              onClick={() => setShowHistory(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              [More..]
            </button>
          </>
        )}
      </div>
    );
  };

  // Compact version for sidebar
  if (compact) {
    return (
      <>
        <div className="space-y-2">
          {/* Status Line */}
          <div
            className="transition-opacity duration-500 ease-in-out"
            style={{ opacity: isTransitioning ? 0 : 1 }}
          >
            {renderCompactStatus()}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onEmail && (
              <button
                onClick={onEmail}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
            )}
            {onWhatsApp && (
              <button
                onClick={onWhatsApp}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
            )}
          </div>
        </div>

        {/* Communication History Modal */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Communication History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <CommunicationHistoryContent docType={docType} docId={docId} />
            </div>
          </div>
        )}
      </>
    );
  }

  // Original full version
  return (
    <>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 border-2 border-green-600 dark:border-green-400 rounded-full flex items-center justify-center mr-3">
              <BsSend className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Send</div>
              <div
                className="transition-opacity duration-500 ease-in-out"
                style={{ opacity: isTransitioning ? 0 : 1 }}
              >
                {renderSendStatus()}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {onEmail && (
              <Button size="sm" color="gray" onClick={onEmail}>
                Email
              </Button>
            )}
            {onWhatsApp && (
              <Button size="sm" color="gray" onClick={onWhatsApp}>
                WhatsApp
              </Button>
            )}
            {onPrint && (
              <Button size="sm" color="gray" onClick={onPrint}>
                Print
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Communication History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Communication History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <CommunicationHistoryContent docType={docType} docId={docId} />
          </div>
        </div>
      )}
    </>
  );
}

// Inline history content component to avoid circular dependency
function CommunicationHistoryContent({ docType, docId }: { docType: string; docId: number }) {
  const [communications, setCommunications] = useState<DocumentCommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunications();
  }, [docType, docId]);

  const fetchCommunications = async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await api.get<any>('/core/communication-logs/', {
        params: {
          doc_type: docType,
          doc_id: docId,
        },
      });
      setCommunications(response.data.results || response.data || []);
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (communications.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No communications found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {communications.map((comm) => {
        const formattedDate = formatDisplayDate(comm.sent_at);
        const relativeTime = formatRelativeTime(comm.sent_at);
        const method = getCommunicationMethodLabel(comm.method);
        const sentBy = comm.sent_by_details.full_name;
        const destination = comm.destination;

        return (
          <div
            key={comm.id}
            className={`p-2.5 rounded-lg border ${
              comm.success
                ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <span className="text-lg mr-2">
                    {comm.success ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                  </span>
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    Sent via {method} to {destination}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  by {sentBy} • {relativeTime}
                </div>
                {comm.error_message && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1 ml-6">
                    Error: {comm.error_message}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right whitespace-nowrap ml-2">
                {formattedDate}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
