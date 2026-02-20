/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Add Product Modal Component
 *
 * Comprehensive product creation and editing modal for POS system.
 * Supports three modes: Create, Edit, and Clone.
 *
 * Features:
 * - Full product information form (name, SKU, description, pricing)
 * - Category selection with inline category creation
 * - Quick Access toggle for frequently sold items
 * - Inventory tracking with quantity and backorder settings
 * - Form validation with user-friendly error messages
 * - Smart error handling for duplicate SKUs and other conflicts
 * - Auto-focus on product name field
 *
 * Form Modes:
 * 1. **Create Mode**: Blank form for new product
 * 2. **Edit Mode**: Pre-filled form for existing product
 * 3. **Clone Mode**: Pre-filled form with modified values (" - Copy" suffix, quantity reset)
 *
 * Business Rules:
 * - Product name and selling price are required
 * - Selling price must be > 0
 * - SKU is optional but must be unique if provided
 * - Inventory tracking enables quantity and backorder fields
 * - Quick Access products appear on main POS screen
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 683-1070)
 *
 * @module AddProductModal
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Modal, Button, Label, Checkbox } from 'flowbite-react';
import { Package, X, Info, DollarSign, Archive, Save } from 'lucide-react';
import { HiPlus } from 'react-icons/hi';
import { toast } from 'sonner';
import { StandardTextInput, StandardSelect, StandardTextarea } from '@/components/common/inputs';
import {
  getPOSCategories,
  createPOSProduct,
  updatePOSProduct,
  type POSProduct,
  type POSCategory,
} from '@/lib/posApi';
import { AddCategoryModal } from '../categories/AddCategoryModal';

/**
 * Form data structure for product
 */
interface ProductFormData {
  name: string;
  sku: string;
  description: string;
  category: number | null;
  default_selling_price: string;
  unit_cost: string;
  is_quick_access: boolean;
  track_inventory: boolean;
  quantity_on_hand: string;
  allow_backorder: boolean;
}

/**
 * Props for AddProductModal component
 */
export interface AddProductModalProps {
  /**
   * Whether modal is visible
   */
  show: boolean;

  /**
   * Callback when modal is closed
   */
  onClose: () => void;

  /**
   * Callback when product is successfully saved
   */
  onSuccess: () => void;

  /**
   * Product being edited (null for create mode)
   */
  editingProduct?: POSProduct | null;

  /**
   * Initial data for clone mode
   * Used when cloning a product with pre-filled values
   */
  initialData?: Partial<ProductFormData>;
}

/**
 * Add Product Modal Component
 *
 * Full-featured product management form.
 *
 * @param props - Component props
 * @returns Add product modal element
 *
 * @example
 * ```tsx
 * import { AddProductModal } from './components/management/products/AddProductModal';
 *
 * function ItemsTab() {
 *   const [showModal, setShowModal] = useState(false);
 *   const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
 *
 *   // Clone mode
 *   const cloneProduct = (product: POSProduct) => {
 *     const clonedData = {
 *       name: `${product.name} - Copy`,
 *       sku: `${product.sku}-COPY`,
 *       quantity_on_hand: '0'
 *     };
 *     setEditingProduct(null);
 *     setInitialData(clonedData);
 *     setShowModal(true);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={() => setShowModal(true)}>Add Product</button>
 *       <AddProductModal
 *         show={showModal}
 *         onClose={() => setShowModal(false)}
 *         onSuccess={() => {
 *           loadProducts();
 *           setShowModal(false);
 *         }}
 *         editingProduct={editingProduct}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function AddProductModal({
  show,
  onClose,
  onSuccess,
  editingProduct,
  initialData,
}: AddProductModalProps) {
  // Form state
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    sku: '',
    description: '',
    category: null,
    default_selling_price: '',
    unit_cost: '',
    is_quick_access: false,
    track_inventory: false,
    quantity_on_hand: '0',
    allow_backorder: true,
  });

  // Categories for dropdown
  const [categories, setCategories] = useState<POSCategory[]>([]);

  // Nested category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  /**
   * Load categories and populate form when modal opens
   */
  useEffect(() => {
    if (show) {
      loadCategories();

      // Load editing product data if provided
      if (editingProduct) {
        setFormData({
          name: editingProduct.name || '',
          sku: editingProduct.sku || '',
          description: editingProduct.description || '',
          category: editingProduct.category || null,
          default_selling_price: editingProduct.default_selling_price?.toString() || '',
          unit_cost: editingProduct.unit_cost?.toString() || '',
          is_quick_access: editingProduct.is_quick_access || false,
          track_inventory: editingProduct.track_inventory || false,
          quantity_on_hand: editingProduct.quantity_on_hand?.toString() || '0',
          allow_backorder:
            editingProduct.allow_backorder !== undefined ? editingProduct.allow_backorder : true,
        });
      }
      // Load cloned/initial data if provided (Clone mode)
      else if (initialData) {
        setFormData({ ...formData, ...initialData });
      }
    }
  }, [show, editingProduct, initialData]);

  /**
   * Load categories from API
   */
  const loadCategories = async () => {
    try {
      const response = await getPOSCategories();
      setCategories(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  };

  /**
   * Validate form fields
   * Returns true if all validations pass
   */
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Product name is required
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required.';
    }

    // Selling price is required and must be > 0
    if (!formData.default_selling_price.trim()) {
      newErrors.price = 'Selling price is required.';
    } else if (parseFloat(formData.default_selling_price) <= 0) {
      newErrors.price = 'Price must be greater than zero.';
    }

    // Unit cost cannot be negative
    if (formData.unit_cost && parseFloat(formData.unit_cost) < 0) {
      newErrors.cost = 'Cost cannot be negative.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   * Creates or updates product based on mode
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before saving.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare product data for API
      const productData: any = {
        name: formData.name,
        default_selling_price: formData.default_selling_price,
        unit_cost: formData.unit_cost || '0',
        is_quick_access: formData.is_quick_access,
        track_inventory: formData.track_inventory,
        quantity_on_hand: formData.track_inventory ? formData.quantity_on_hand : '0',
        allow_backorder: formData.track_inventory ? formData.allow_backorder : true,
      };

      // Only include SKU if provided (handle empty string as null)
      if (formData.sku && formData.sku.trim()) {
        productData.sku = formData.sku.trim();
      } else {
        productData.sku = null;
      }

      // Only include description if provided
      if (formData.description && formData.description.trim()) {
        productData.description = formData.description.trim();
      }

      // Only include category if selected
      if (formData.category) {
        productData.category = formData.category;
      }

      // Edit mode: Update existing product
      if (editingProduct) {
        await updatePOSProduct(editingProduct.id, productData);
        toast.success('Product updated successfully!');
      }
      // Create mode: Create new product
      else {
        await createPOSProduct(productData);
        toast.success('Product added successfully!');
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to save product:', error);

      // Extract meaningful error message from API response
      let errorMessage = editingProduct ? 'Failed to update product.' : 'Failed to add product.';

      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.sku) {
          // SKU uniqueness violation
          errorMessage = `SKU Error: ${error.response.data.sku[0]}`;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          // Show first error from response
          const firstError = Object.values(error.response.data)[0];
          if (firstError && Array.isArray(firstError)) {
            errorMessage = firstError[0];
          }
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Close modal and reset form state
   */
  const handleClose = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      category: null,
      default_selling_price: '',
      unit_cost: '',
      is_quick_access: false,
      track_inventory: false,
      quantity_on_hand: '0',
      allow_backorder: true,
    });
    setErrors({});
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal show={show} size="3xl" onClose={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <Package className="h-5 w-5 text-primary-600" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingProduct
                    ? 'Edit Product'
                    : initialData
                      ? 'Clone Product'
                      : 'Add New Product'}
                </h3>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* FORM CONTENT (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Basic Information Section */}
          <div className="section-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary-600" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <Label htmlFor="product-name">
                  Product Name <span className="text-red-500">*</span>
                </Label>
                <StandardTextInput
                  id="product-name"
                  placeholder="e.g., Business Cards"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                  className={errors.name ? 'border-red-400' : ''}
                />
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <Label htmlFor="product-sku">SKU (Stock Keeping Unit)</Label>
                <StandardTextInput
                  id="product-sku"
                  placeholder="Optional, e.g., BC-001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="product-description">Description</Label>
              <StandardTextarea
                id="product-description"
                placeholder="A brief description for internal notes or future use..."
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          {/* Pricing & Category Section */}
          <div className="section-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary-600" />
              Pricing & Category
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selling Price */}
              <div className="space-y-1.5">
                <Label htmlFor="product-price">
                  Selling Price (VAT Inclusive) (Rs.) <span className="text-red-500">*</span>
                </Label>
                <StandardTextInput
                  id="product-price"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.default_selling_price}
                  onChange={(e) =>
                    setFormData({ ...formData, default_selling_price: e.target.value })
                  }
                  required
                  className={errors.price ? 'border-red-400' : ''}
                />
              </div>

              {/* Unit Cost */}
              <div className="space-y-1.5">
                <Label htmlFor="product-cost">Unit Cost (Rs.)</Label>
                <StandardTextInput
                  id="product-cost"
                  placeholder="Optional cost price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  className={errors.cost ? 'border-red-400' : ''}
                />
              </div>

              {/* Category with Add Button */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="product-category">Category</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <StandardSelect
                      id="product-category"
                      value={formData.category || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </StandardSelect>
                  </div>
                  <Button
                    color="gray"
                    size="sm"
                    onClick={() => setShowCategoryModal(true)}
                    title="Add New Category"
                    type="button"
                  >
                    <HiPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Section */}
          <div className="section-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label htmlFor="quick-access" className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                id="quick-access"
                checked={formData.is_quick_access}
                onChange={(e) => setFormData({ ...formData, is_quick_access: e.target.checked })}
                className="text-primary-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show in Quick Access
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pin this product to the main POS screen for faster checkout.
                </p>
              </div>
            </label>
          </div>

          {/* Inventory Section */}
          <div className="section-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Archive className="h-4 w-4 text-primary-600" />
              Inventory
            </h4>

            {/* Track Inventory Toggle */}
            <label
              htmlFor="track-inventory"
              className="flex items-center gap-2 cursor-pointer mb-3"
            >
              <Checkbox
                id="track-inventory"
                checked={formData.track_inventory}
                onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
                className="text-primary-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Track stock levels for this product
              </span>
            </label>

            {/* Inventory Fields (Conditional) */}
            {formData.track_inventory && (
              <div className="border-l-2 border-primary-200 dark:border-primary-700/50 pl-4 ml-2 space-y-4">
                {/* Quantity on Hand */}
                <div className="space-y-1.5">
                  <Label htmlFor="qty-on-hand">Quantity in Hand</Label>
                  <StandardTextInput
                    id="qty-on-hand"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={formData.quantity_on_hand}
                    onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
                  />
                </div>

                {/* Allow Backorder */}
                <label htmlFor="allow-backorder" className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="allow-backorder"
                    checked={formData.allow_backorder}
                    onChange={(e) =>
                      setFormData({ ...formData, allow_backorder: e.target.checked })
                    }
                    className="text-primary-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Allow selling even when out of stock
                  </span>
                </label>
              </div>
            )}
          </div>
        </form>

        {/* FOOTER */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-end items-center gap-3">
            <Button color="gray" onClick={handleClose} disabled={isSubmitting} size="sm">
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              isProcessing={isSubmitting}
              size="sm"
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingProduct ? 'Update Product' : initialData ? 'Create Clone' : 'Save Product'}
            </Button>
          </div>
        </div>

        {/* Nested Category Modal */}
        <AddCategoryModal
          show={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={(newCategory) => {
            // Add new category to dropdown and auto-select it
            setCategories([...categories, newCategory]);
            setFormData({ ...formData, category: newCategory.id });
            // Don't close modal - let user see the grid update
          }}
        />
      </div>
    </Modal>
  );
}
