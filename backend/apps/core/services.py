"""
Service layer for logging document communications
"""
from typing import Optional, List
from django.contrib.auth import get_user_model
from .models import DocumentCommunicationLog

User = get_user_model()


class CommunicationLogger:
    """
    Service class for logging document communications (Email, WhatsApp, Print)
    across Quotations, Invoices, and Orders.
    """

    @staticmethod
    def log_email(
        doc_type: str,
        doc_id: int,
        destination: str,
        success: bool,
        user: User,
        message: Optional[str] = None,
        error: Optional[str] = None
    ) -> DocumentCommunicationLog:
        """
        Log an email communication

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            destination: Email address
            success: Whether the email was sent successfully
            user: User who sent the email
            message: Optional additional details
            error: Optional error message if failed

        Returns:
            DocumentCommunicationLog instance
        """
        return DocumentCommunicationLog.objects.create(
            doc_type=doc_type,
            doc_id=doc_id,
            method='email',
            destination=destination,
            success=success,
            sent_by=user,
            message=message,
            error_message=error
        )

    @staticmethod
    def log_whatsapp(
        doc_type: str,
        doc_id: int,
        destination: str,
        success: bool,
        user: User,
        message: Optional[str] = None,
        error: Optional[str] = None
    ) -> DocumentCommunicationLog:
        """
        Log a WhatsApp communication

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            destination: Phone number
            success: Whether the message was sent successfully
            user: User who sent the message
            message: Optional additional details
            error: Optional error message if failed

        Returns:
            DocumentCommunicationLog instance
        """
        return DocumentCommunicationLog.objects.create(
            doc_type=doc_type,
            doc_id=doc_id,
            method='whatsapp',
            destination=destination,
            success=success,
            sent_by=user,
            message=message,
            error_message=error
        )

    @staticmethod
    def log_print(
        doc_type: str,
        doc_id: int,
        success: bool,
        user: User,
        destination: str = "Physical Copy",
        message: Optional[str] = None,
        error: Optional[str] = None
    ) -> DocumentCommunicationLog:
        """
        Log a print communication

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            success: Whether the print was successful
            user: User who initiated the print
            destination: Printer name or "Physical Copy"
            message: Optional additional details
            error: Optional error message if failed

        Returns:
            DocumentCommunicationLog instance
        """
        return DocumentCommunicationLog.objects.create(
            doc_type=doc_type,
            doc_id=doc_id,
            method='print',
            destination=destination,
            success=success,
            sent_by=user,
            message=message,
            error_message=error
        )

    @staticmethod
    def get_latest_communication(
        doc_type: str,
        doc_id: int,
        method: Optional[str] = None,
        success_only: bool = True
    ) -> Optional[DocumentCommunicationLog]:
        """
        Get the latest communication for a document

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            method: Optional filter by method ('email', 'whatsapp', 'print')
            success_only: Only return successful communications

        Returns:
            Latest DocumentCommunicationLog or None
        """
        queryset = DocumentCommunicationLog.objects.filter(
            doc_type=doc_type,
            doc_id=doc_id
        )

        if method:
            queryset = queryset.filter(method=method)

        if success_only:
            queryset = queryset.filter(success=True)

        return queryset.first()

    @staticmethod
    def get_communication_history(
        doc_type: str,
        doc_id: int,
        method: Optional[str] = None
    ) -> List[DocumentCommunicationLog]:
        """
        Get all communications for a document

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            method: Optional filter by method ('email', 'whatsapp', 'print')

        Returns:
            List of DocumentCommunicationLog instances (ordered by sent_at desc)
        """
        queryset = DocumentCommunicationLog.objects.filter(
            doc_type=doc_type,
            doc_id=doc_id
        )

        if method:
            queryset = queryset.filter(method=method)

        return list(queryset)

    @staticmethod
    def get_communication_count(
        doc_type: str,
        doc_id: int,
        method: Optional[str] = None,
        success_only: bool = True
    ) -> int:
        """
        Get count of communications for a document

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            method: Optional filter by method ('email', 'whatsapp', 'print')
            success_only: Only count successful communications

        Returns:
            Count of communications
        """
        queryset = DocumentCommunicationLog.objects.filter(
            doc_type=doc_type,
            doc_id=doc_id
        )

        if method:
            queryset = queryset.filter(method=method)

        if success_only:
            queryset = queryset.filter(success=True)

        return queryset.count()

    @staticmethod
    def has_been_sent(
        doc_type: str,
        doc_id: int,
        method: Optional[str] = None
    ) -> bool:
        """
        Check if a document has been sent via any method

        Args:
            doc_type: Type of document ('quotation', 'invoice', 'order')
            doc_id: ID of the document
            method: Optional filter by method ('email', 'whatsapp', 'print')

        Returns:
            True if document has been sent successfully
        """
        return CommunicationLogger.get_communication_count(
            doc_type=doc_type,
            doc_id=doc_id,
            method=method,
            success_only=True
        ) > 0
