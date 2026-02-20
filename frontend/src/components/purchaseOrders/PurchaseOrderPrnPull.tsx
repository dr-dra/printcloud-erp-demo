'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvPrnItem } from '@/types/inventory';

interface PurchaseOrderPrnPullProps {
  purchaseOrderId?: number;
  purchaseOrderStatus?: string;
  onAdded?: () => void;
}

interface PrnRow extends InvPrnItem {
  orderQty: string;
}

export default function PurchaseOrderPrnPull({
  purchaseOrderId,
  purchaseOrderStatus,
  onAdded,
}: PurchaseOrderPrnPullProps) {
  const [rows, setRows] = useState<PrnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = purchaseOrderId && ['draft', 'sent'].includes(purchaseOrderStatus || '');

  const fetchAvailable = useCallback(async () => {
    if (!purchaseOrderId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/inventory/prn-items/available/');
      const data: InvPrnItem[] = response.data || [];
      const mapped = data.map((item) => ({
        ...item,
        orderQty: String(item.remaining_to_order || item.required_qty || '0'),
      }));
      setRows(mapped);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load PRN items.'));
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    if (purchaseOrderId) {
      fetchAvailable();
    }
  }, [purchaseOrderId, fetchAvailable]);

  const updateQty = (id: number, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, orderQty: value } : row)));
  };

  const handleAdd = async (row: PrnRow) => {
    if (!purchaseOrderId) return;
    const quantity = Number(row.orderQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid quantity to order.');
      return;
    }

    try {
      await api.post(`/inventory/prn-items/${row.id}/add-to-po/`, {
        purchase_order: purchaseOrderId,
        quantity,
      });
      await fetchAvailable();
      onAdded?.();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to add PRN item to PO.'));
    }
  };

  const emptyState = useMemo(() => !rows.length && !loading, [rows.length, loading]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pull From PRNs</h4>
        <Button size="xs" color="gray" onClick={fetchAvailable} disabled={!purchaseOrderId}>
          Refresh
        </Button>
      </div>

      {!isEnabled && (
        <div className="text-sm text-gray-500">
          Save the PO as Draft first, or ensure the PO is Draft/Sent to add PRN items.
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <Table>
          <Table.Head>
            <Table.HeadCell>PRN</Table.HeadCell>
            <Table.HeadCell>Item</Table.HeadCell>
            <Table.HeadCell>Remaining</Table.HeadCell>
            <Table.HeadCell>Order Qty</Table.HeadCell>
            <Table.HeadCell></Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {emptyState && (
              <Table.Row>
                <Table.Cell colSpan={5} className="text-sm text-gray-500">
                  No PRN items available to order.
                </Table.Cell>
              </Table.Row>
            )}
            {rows.map((row) => (
              <Table.Row key={row.id}>
                <Table.Cell>{row.prn_number || row.prn}</Table.Cell>
                <Table.Cell>{row.item_name}</Table.Cell>
                <Table.Cell>{row.remaining_to_order}</Table.Cell>
                <Table.Cell className="w-32">
                  <StandardTextInput
                    type="number"
                    value={row.orderQty}
                    onChange={(e) => updateQty(row.id, e.target.value)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Button size="xs" onClick={() => handleAdd(row)} disabled={!isEnabled}>
                    Add to PO
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
}
