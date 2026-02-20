'use client';

import { useEffect, useState } from 'react';
import { Button, Label, Modal, Select, Spinner, TextInput, Textarea } from 'flowbite-react';
import { toast } from 'sonner';
import { useBankAccounts, useCreateCashDeposit } from '@/hooks/useAccounting';
import { getErrorMessage } from '@/utils/errorHandling';

interface CashDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CashDepositModal({ isOpen, onClose, onSuccess }: CashDepositModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const { data: bankAccounts = [], isLoading: isLoadingAccounts } = useBankAccounts();
  const { mutateAsync, isPending } = useCreateCashDeposit();

  useEffect(() => {
    if (isOpen) {
      setDate(today);
      setAmount('');
      setBankAccountId('');
      setReference('');
      setNotes('');
    }
  }, [isOpen, today]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);

    if (!bankAccountId) {
      toast.error('Please select a bank account.');
      return;
    }

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be greater than 0.');
      return;
    }

    try {
      await mutateAsync({
        date,
        amount,
        bank_account_id: Number(bankAccountId),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Cash deposit recorded successfully.');
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create cash deposit.'));
    }
  };

  const isSubmitDisabled =
    isPending || !bankAccountId || !amount || Number.isNaN(Number(amount)) || Number(amount) <= 0;

  return (
    <Modal show={isOpen} onClose={handleClose} size="lg">
      <Modal.Header>Deposit Cash to Bank</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cash-deposit-date" value="Date" />
            <TextInput
              id="cash-deposit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="cash-deposit-amount" value="Amount" />
            <TextInput
              id="cash-deposit-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="cash-deposit-bank" value="Bank Account" />
            <Select
              id="cash-deposit-bank"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              required
            >
              <option value="">Select a bank account</option>
              {isLoadingAccounts && <option>Loading bank accounts...</option>}
              {!isLoadingAccounts &&
                bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_code} - {account.account_name}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="cash-deposit-reference" value="Reference / Deposit Slip No" />
            <TextInput
              id="cash-deposit-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <Label htmlFor="cash-deposit-notes" value="Notes" />
            <Textarea
              id="cash-deposit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button color="gray" onClick={handleClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
          {isPending && <Spinner size="sm" className="mr-2" />}
          Deposit
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
