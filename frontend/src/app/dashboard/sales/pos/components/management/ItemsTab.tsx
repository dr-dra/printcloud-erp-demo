/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Items Tab Component (Management View)
 *
 * Product inventory management interface for POS system.
 * Provides comprehensive product CRUD operations with category management.
 *
 * Features:
 * - Product listing with search and filtering
 * - Add new product with full details
 * - Edit existing product information
 * - Clone product (duplicate with modifications)
 * - Delete/Discontinue product (with sales history protection)
 * - Category management integration
 * - Quick Access toggle for frequently sold items
 * - Inventory tracking configuration
 *
 * Business Rules:
 * - Products with sales history cannot be deleted, only discontinued
 * - Cloned products reset quantity to 0 and append " - Copy" to name
 * - Products can be marked for quick access (shown in POS main screen)
 * - Discontinuing products hides them from POS while preserving history
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 315-678)
 *
 * @module ItemsTab
 */

'use client';

import { useState, useEffect } from 'react';
import { HiPlus } from 'react-icons/hi';
import { FolderPlus, Pencil, Copy, Trash2 } from 'lucide-react';
import { Button } from 'flowbite-react';
import { toast } from 'sonner';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { formatCurrency } from '../../utils/currency';
import { getPOSProducts, updatePOSProduct, deletePOSProduct, type POSProduct } from '@/lib/posApi';

// Import product management components
import { AddProductModal } from './products/AddProductModal';
import { ProductDeleteConfirmModal } from './products/ProductDeleteConfirmModal';
import { AddCategoryModal } from './categories/AddCategoryModal';

/**
 * Items Tab Component
 *
 * Main product management interface with table and modals.
 *
 * @returns Items tab element
 *
 * @example
 * ```tsx
 * import { ItemsTab } from './components/management/ItemsTab';
 *
 * function ManagementView() {
 *   const [activeTab, setActiveTab] = useState(0);
 *
 *   return (
 *     <div>
 *       {activeTab === 2 && <ItemsTab />}
 *     </div>
 *   );
 * }
 * ```
 */
export function ItemsTab() {
  // Product data state
  const [items, setItems] = useState<POSProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal visibility state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Edit/Clone state
  const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
  const [cloneData, setCloneData] = useState<any>(null);

  // Delete confirmation state
  const [productToDelete, setProductToDelete] = useState<POSProduct | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Load products on component mount
   */
  useEffect(() => {
    loadItems();
  }, []);

  /**
   * Load all products from API
   */
  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await getPOSProducts();
      setItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load items:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * DataTable column definitions
   */
  const columns: DataTableColumn[] = [
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'product_name', label: 'Product Name', sortable: true },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'price', label: 'Price', sortable: true },
    { key: 'stock', label: 'Stock', sortable: false },
    { key: 'quick_access', label: 'Quick Access', sortable: false },
  ];

  /**
   * Transform raw product data for DataTable display
   */
  const tableData = items.map((item) => ({
    id: item.id,
    sku: item.sku || 'N/A',
    product_name: item.name || 'Unnamed Product',
    category_name: item.category_name || 'Uncategorized',
    price: formatCurrency(item.default_selling_price || 0),
    stock: item.quantity_on_hand || 0,
    quick_access: item.is_quick_access ? 'Yes' : 'No',
    _raw: item, // Store raw data for actions
    _clickable: true, // Mark row as clickable
  }));

  /**
   * Filter table data based on search query
   */
  const filteredData = tableData.filter(
    (item) =>
      searchQuery === '' ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  /**
   * Handle action button clicks (Edit, Clone, Delete)
   */
  const handleActionClick = (action: string, itemId: number) => {
    const product = items.find((item) => item.id === itemId);
    if (!product) return;

    if (action === 'edit') {
      setEditingProduct(product);
      setShowAddModal(true);
    } else if (action === 'clone') {
      handleCloneProduct(product);
    } else if (action === 'delete') {
      handleDeleteProduct(product);
    }
  };

  /**
   * Handle row click (opens edit modal)
   */
  const handleRowClick = (row: any) => {
    const product = items.find((item) => item.id === row.id);
    if (product) {
      setEditingProduct(product);
      setShowAddModal(true);
    }
  };

  /**
   * Clone product with modifications
   * - Appends " - Copy" to name
   * - Appends "-COPY" to SKU
   * - Resets quantity to 0
   */
  const handleCloneProduct = (product: POSProduct) => {
    const clonedData = {
      name: `${product.name} - Copy`,
      sku: product.sku ? `${product.sku}-COPY` : '',
      description: product.description || '',
      category: product.category || null,
      default_selling_price: product.default_selling_price?.toString() || '',
      unit_cost: product.unit_cost?.toString() || '',
      is_quick_access: product.is_quick_access || false,
      track_inventory: product.track_inventory || false,
      quantity_on_hand: '0', // Reset to 0 per user requirement
      allow_backorder: product.allow_backorder !== undefined ? product.allow_backorder : true,
    };

    setCloneData(clonedData);
    setEditingProduct(null); // Not editing, creating new
    setShowAddModal(true);
  };

  /**
   * Initiate product deletion
   * Opens confirmation modal
   */
  const handleDeleteProduct = (product: POSProduct) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  };

  /**
   * Confirm and execute product deletion/discontinuation
   * - Products with sales: Discontinue (set is_active = false)
   * - Products without sales: Delete (soft delete)
   */
  const confirmDelete = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      if (productToDelete.sales_count > 0) {
        // Discontinue product instead of deleting
        await updatePOSProduct(productToDelete.id, { is_active: false });
        toast.success(`Product "${productToDelete.name}" has been discontinued successfully`);
      } else {
        // Delete product (will be soft deleted on backend)
        await deletePOSProduct(productToDelete.id);
        toast.success(`Product "${productToDelete.name}" deleted successfully`);
      }

      // Refresh product list
      await loadItems();

      // Close confirmation modal
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete/discontinue product:', error);
      toast.error(error.message || 'Failed to process request');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Cancel product deletion
   */
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setProductToDelete(null);
  };

  /**
   * Render action buttons for each table row
   */
  const renderActions = (row: any) => (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
      {/* Edit Button */}
      <button
        type="button"
        onClick={() => handleActionClick('edit', row.id)}
        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
        title="Edit Product"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {/* Clone Button */}
      <button
        type="button"
        onClick={() => handleActionClick('clone', row.id)}
        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
        title="Clone Product"
      >
        <Copy className="h-4 w-4" />
      </button>

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => handleActionClick('delete', row.id)}
        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
        title="Delete Product"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar: Action Buttons & Search */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        {/* New Product Button */}
        <Button onClick={() => setShowAddModal(true)} size="sm">
          <HiPlus className="mr-2 h-4 w-4" />
          New Product
        </Button>

        {/* Search & Category Button */}
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-48 md:w-64 pl-3 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />

          {/* Add Category Button */}
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 bg-white rounded-lg hover:bg-gray-100 dark:text-white dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors"
            title="Add New Category"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Category</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <DataTable
            title="Products"
            data={filteredData}
            columns={columns}
            loading={isLoading}
            actions={renderActions}
            onRowClick={handleRowClick}
          />
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <AddProductModal
        show={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingProduct(null);
          setCloneData(null);
        }}
        onSuccess={() => {
          loadItems();
          setShowAddModal(false);
          setEditingProduct(null);
          setCloneData(null);
        }}
        editingProduct={editingProduct}
        initialData={cloneData}
      />

      {/* Add Category Modal */}
      <AddCategoryModal
        show={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSuccess={() => {
          loadItems();
          // Don't close modal - let user see the grid update and add more categories if needed
        }}
      />

      {/* Delete/Discontinue Confirmation Modal */}
      {showDeleteConfirm && productToDelete && (
        <ProductDeleteConfirmModal
          show={showDeleteConfirm}
          product={productToDelete}
          isDeleting={isDeleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}
