'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Label, Textarea, TextInput, Spinner } from 'flowbite-react';
import { toast } from 'sonner';
import { coreAPI } from '@/lib/api';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshotFile: File | null;
}

export function BugReportModal({ isOpen, onClose, screenshotFile }: BugReportModalProps) {
  const [pageUrl, setPageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPageUrl(window.location.href);
    }
  }, [isOpen]);

  const resetState = () => {
    setDescription('');
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetState();
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe the issue.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('page_url', pageUrl);
      formData.append('description', description.trim());
      if (typeof window !== 'undefined') {
        formData.append('user_agent', window.navigator.userAgent);
      }
      if (screenshotFile) {
        formData.append('screenshot', screenshotFile);
      }

      await coreAPI.createBugReport(formData);
      toast.success('Thanks! Your report was sent.');
      resetState();
      onClose();
    } catch {
      toast.error('Failed to send report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={handleClose} size="2xl">
      <Modal.Header>Report an Issue</Modal.Header>
      <Modal.Body>
        <div className="space-y-5">
          <div>
            <Label htmlFor="bug-report-url" value="Page URL" />
            <TextInput id="bug-report-url" value={pageUrl} readOnly />
          </div>

          <div>
            <Label htmlFor="bug-report-description" value="Description" />
            <Textarea
              id="bug-report-description"
              placeholder="Tell us what happened and what you expected."
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-between">
        <Button color="gray" onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button color="blue" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Sending...
            </>
          ) : (
            'Send Report'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
