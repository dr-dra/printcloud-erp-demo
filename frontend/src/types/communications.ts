/**
 * Types for Document Communication Logging
 */

export type DocumentType = 'quotation' | 'invoice' | 'order' | 'purchase_order';
export type CommunicationMethod = 'email' | 'whatsapp' | 'print';

export interface SentByUser {
  id: number;
  username: string;
  full_name: string;
}

export interface DocumentCommunicationLog {
  id: number;
  doc_type: DocumentType;
  doc_id: number;
  method: CommunicationMethod;
  destination: string;
  success: boolean;
  sent_at: string;
  sent_by: number;
  sent_by_details: SentByUser;
  message?: string;
  error_message?: string;
}

export interface CommunicationHistoryProps {
  docType: DocumentType;
  docId: number;
  isOpen: boolean;
  onClose: () => void;
}

export interface SendCardProps {
  docType: DocumentType;
  docId: number;
  onEmail?: () => void;
  onWhatsApp?: () => void;
  onPrint?: () => void;
  refreshTrigger?: number;
  compact?: boolean;
}
