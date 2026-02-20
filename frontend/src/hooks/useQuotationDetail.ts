/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { SalesQuotation } from '@/types/quotations';
import { toast } from 'sonner';

interface ReminderData {
  reminderDate: Date;
  reminderTime: string;
  notes: string;
  assigneeUserId: number;
  autoCancelStates: string[];
}

interface UseQuotationDetailReturn {
  quotation: SalesQuotation | null;
  loading: boolean;
  error: string | null;
  reminderModalOpen: boolean;
  conflictModalOpen: boolean;
  existingReminder: any;
  processingReminder: boolean;
  setReminderModalOpen: (open: boolean) => void;
  handleSetReminder: (reminderData: ReminderData) => Promise<void>;
  handleUpdateExistingReminder: () => Promise<void>;
  handleCreateAdditionalReminder: () => Promise<void>;
  handleCancelConflict: () => void;
  handleRetry: () => void;
  setError: (error: string | null) => void;
}

export function useQuotationDetail(
  quotationId: string,
  isAuthenticated: boolean,
): UseQuotationDetailReturn {
  const [quotation, setQuotation] = useState<SalesQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [existingReminder, setExistingReminder] = useState<any>(null);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);
  const [processingReminder, setProcessingReminder] = useState(false);

  // Fetch quotation data
  useEffect(() => {
    const fetchQuotation = async () => {
      if (!isAuthenticated || !quotationId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await api.get<SalesQuotation>(`/sales/quotations/${quotationId}/`);
        setQuotation(response.data);
      } catch (err) {
        const errorMessage = getErrorMessage(err as any);
        setError(errorMessage);
        console.error('Error fetching quotation:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotation();
  }, [isAuthenticated, quotationId]);

  // Handle retry
  const handleRetry = () => {
    const fetchQuotation = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get<SalesQuotation>(`/sales/quotations/${quotationId}/`);
        setQuotation(response.data);
      } catch (err) {
        const errorMessage = getErrorMessage(err as any);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotation();
  };

  // Handle set reminder
  const handleSetReminder = async (reminderData: ReminderData) => {
    try {
      setProcessingReminder(true);

      // Combine date and time
      const [hours, minutes] = reminderData.reminderTime.split(':');
      const finalDateTime = new Date(reminderData.reminderDate);
      finalDateTime.setHours(parseInt(hours), parseInt(minutes));

      // Validate required data
      const entityId = parseInt(quotationId);
      if (isNaN(entityId)) {
        throw new Error('Invalid quotation ID');
      }

      if (!quotation?.quot_number) {
        throw new Error('Quotation number not available');
      }

      if (!reminderData.assigneeUserId) {
        throw new Error('Assignee user ID is required');
      }

      // Check if reminder already exists first
      const existingResponse = await api.get('/reminders/', {
        params: {
          entity_type: 'quotation',
          entity_id: entityId,
          assignee_user: reminderData.assigneeUserId,
        },
      });

      const existingReminders = Array.isArray(existingResponse.data)
        ? existingResponse.data
        : existingResponse.data?.results || [];

      const activeReminder = existingReminders.find(
        (r: any) =>
          r.entity_type === 'quotation' &&
          Number(r.entity_id) === Number(entityId) &&
          Number(r.assignee_user.id) === Number(reminderData.assigneeUserId) &&
          (r.status === 'pending' || r.status === 'sent'),
      );

      if (activeReminder) {
        // Get assignee user name
        const usersResponse = await api.get('/reminders/assignable_users/');
        const users = usersResponse.data;
        const assigneeUser = users.find((u: any) => u.id === reminderData.assigneeUserId);

        setExistingReminder(activeReminder);
        setPendingReminderData({
          ...reminderData,
          assigneeUserName: assigneeUser?.full_name || 'Unknown User',
        });
        setReminderModalOpen(false);
        setConflictModalOpen(true);
        return;
      }

      // Create new reminder if no active reminder exists
      const requestData = {
        entity_type: 'quotation',
        entity_id: entityId,
        entity_ref: `Follow up: Quotation #${quotation.quot_number}`,
        assignee_user: reminderData.assigneeUserId,
        due_at: finalDateTime.toISOString(),
        note: reminderData.notes || '',
        origin_module: 'quotations',
        auto_cancel_on_states: reminderData.autoCancelStates || [],
        link_path: `/dashboard/sales/quotations/${quotationId}`,
        company_id: null,
      };

      await api.post('/reminders/', requestData);

      toast.success(
        `Reminder set successfully for ${finalDateTime.toLocaleDateString()} at ${reminderData.reminderTime}`,
        {
          description: `Assigned to ${pendingReminderData?.assigneeUserName || 'user'}`,
          duration: 4000,
        },
      );
    } catch (err: any) {
      console.error('Error setting reminder:', err);

      if (err.response?.status === 400) {
        const errorData = err.response.data;
        if (errorData && typeof errorData === 'object') {
          const errorMessages = Object.entries(errorData)
            .map(([field, messages]) => {
              if (Array.isArray(messages)) {
                return `${field}: ${messages.join(', ')}`;
              }
              return `${field}: ${messages}`;
            })
            .join('; ');
          toast.error('Validation Error', {
            description: errorMessages,
            duration: 5000,
          });
          return;
        }
      }

      const errorMessage = getErrorMessage(err);
      toast.error('Failed to set reminder', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setProcessingReminder(false);
    }
  };

  // Handle updating existing reminder
  const handleUpdateExistingReminder = async () => {
    if (!existingReminder || !pendingReminderData) return;

    try {
      setProcessingReminder(true);

      const [hours, minutes] = pendingReminderData.reminderTime.split(':');
      const finalDateTime = new Date(pendingReminderData.reminderDate);
      finalDateTime.setHours(parseInt(hours), parseInt(minutes));

      await api.patch(`/reminders/${existingReminder.id}/`, {
        due_at: finalDateTime.toISOString(),
        note: pendingReminderData.notes || '',
      });

      toast.success(
        `Reminder updated successfully for ${finalDateTime.toLocaleDateString()} at ${pendingReminderData.reminderTime}`,
        {
          description: `Assigned to ${pendingReminderData.assigneeUserName}`,
          duration: 4000,
        },
      );

      setConflictModalOpen(false);
      setExistingReminder(null);
      setPendingReminderData(null);
    } catch (err: any) {
      console.error('Error updating reminder:', err);
      const errorMessage = getErrorMessage(err);
      toast.error('Failed to update reminder', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setProcessingReminder(false);
    }
  };

  // Handle creating additional reminder (for different users)
  const handleCreateAdditionalReminder = async () => {
    if (!pendingReminderData) return;

    try {
      setProcessingReminder(true);

      const [hours, minutes] = pendingReminderData.reminderTime.split(':');
      const finalDateTime = new Date(pendingReminderData.reminderDate);
      finalDateTime.setHours(parseInt(hours), parseInt(minutes));

      const entityId = parseInt(quotationId);
      const requestData = {
        entity_type: 'quotation',
        entity_id: entityId,
        entity_ref: `Follow up: Quotation #${quotation?.quot_number}`,
        assignee_user: pendingReminderData.assigneeUserId,
        due_at: finalDateTime.toISOString(),
        note: pendingReminderData.notes || '',
        origin_module: 'quotations',
        auto_cancel_on_states: pendingReminderData.autoCancelStates || [],
        link_path: `/dashboard/sales/quotations/${quotationId}`,
        company_id: null,
      };

      await api.post('/reminders/', requestData);

      toast.success(
        `Additional reminder created for ${finalDateTime.toLocaleDateString()} at ${pendingReminderData.reminderTime}`,
        {
          description: `Assigned to ${pendingReminderData.assigneeUserName}`,
          duration: 4000,
        },
      );

      setConflictModalOpen(false);
      setExistingReminder(null);
      setPendingReminderData(null);
    } catch (err: any) {
      console.error('Error creating additional reminder:', err);
      const errorMessage = getErrorMessage(err);
      toast.error('Failed to create additional reminder', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setProcessingReminder(false);
    }
  };

  // Handle canceling reminder conflict resolution
  const handleCancelConflict = () => {
    setConflictModalOpen(false);
    setExistingReminder(null);
    setPendingReminderData(null);
  };

  return {
    quotation,
    loading,
    error,
    reminderModalOpen,
    conflictModalOpen,
    existingReminder,
    processingReminder,
    setReminderModalOpen,
    handleSetReminder,
    handleUpdateExistingReminder,
    handleCreateAdditionalReminder,
    handleCancelConflict,
    handleRetry,
    setError,
  };
}
