/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Add Category Modal Component
 *
 * Comprehensive category management modal for POS product organization.
 * Combines creation, editing, listing, and deletion in a single interface.
 *
 * Features:
 * - Two-column layout: Form on left, category list on right
 * - Duplicate detection using Levenshtein distance similarity algorithm
 * - Create new categories with name and optional description
 * - Edit existing categories inline
 * - Delete categories (with product count protection)
 * - Real-time category list updates after add/edit/delete
 * - Visual highlighting for editing and conflicting categories
 * - Form stays open after adding to allow bulk category creation
 *
 * Business Rules:
 * - Category names must be unique (exact match blocked)
 * - Similar names (>=75% match) are warned against to prevent confusion
 * - Categories with products cannot be deleted (must reassign products first)
 * - Empty categories can be deleted permanently
 * - New categories auto-select in parent form's dropdown
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 1168-1689)
 *
 * @module AddCategoryModal
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Modal, Button, Label, Badge, Spinner } from 'flowbite-react';
import {
  FolderPlus,
  X,
  Save,
  AlertTriangle,
  RefreshCw,
  Archive,
  Package,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { StandardTextInput } from '@/components/common/inputs';
import {
  getPOSCategories,
  createPOSCategory,
  updatePOSCategory,
  deletePOSCategory,
  type POSCategory,
} from '@/lib/posApi';
import { findSimilarCategory } from '../../../utils/similarity';

/**
 * Props for AddCategoryModal component
 */
export interface AddCategoryModalProps {
  /**
   * Whether modal is visible
   */
  show: boolean;

  /**
   * Callback when modal is closed
   */
  onClose: () => void;

  /**
   * Callback when category is successfully created/updated
   * @param newCategory - The created or updated category
   */
  onSuccess: (newCategory: POSCategory) => void;
}

/**
 * Add Category Modal Component
 *
 * Full-featured category management with inline editing and listing.
 *
 * @param props - Component props
 * @returns Add category modal element
 *
 * @example
 * ```tsx
 * import { AddCategoryModal } from './components/management/categories/AddCategoryModal';
 *
 * function ProductForm() {
 *   const [showCategoryModal, setShowCategoryModal] = useState(false);
 *   const [categories, setCategories] = useState<POSCategory[]>([]);
 *
 *   return (
 *     <div>
 *       <button onClick={() => setShowCategoryModal(true)}>Add Category</button>
 *       <AddCategoryModal
 *         show={showCategoryModal}
 *         onClose={() => setShowCategoryModal(false)}
 *         onSuccess={(newCategory) => {
 *           setCategories([...categories, newCategory]);
 *           // Auto-select new category in dropdown if needed
 *         }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function AddCategoryModal({ show, onClose, onSuccess }: AddCategoryModalProps) {
  // Form state
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category list state
  const [existingCategories, setExistingCategories] = useState<POSCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Validation state
  const [validationError, setValidationError] = useState<string>('');
  const [conflictingCategory, setConflictingCategory] = useState<POSCategory | null>(null);

  // Delete confirmation state
  const [categoryToDelete, setCategoryToDelete] = useState<POSCategory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [editingCategory, setEditingCategory] = useState<POSCategory | null>(null);

  /**
   * Load categories when modal opens
   */
  useEffect(() => {
    if (show) {
      loadExistingCategories();
    }
  }, [show]);

  /**
   * Load all existing categories from API
   */
  const loadExistingCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const response = await getPOSCategories();

      // Handle both paginated and non-paginated responses
      let categoriesData: POSCategory[] = [];
      if (Array.isArray(response.data)) {
        categoriesData = response.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        categoriesData = response.data.results;
      } else if (response.data && typeof response.data === 'object') {
        categoriesData = [response.data as POSCategory];
      }

      setExistingCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load existing categories');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  /**
   * Handle form submission (Create or Update)
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setValidationError('');
    setConflictingCategory(null);

    // Basic validation
    if (!categoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    // Check for duplicates and similar names (skip current category if editing)
    const categoriesToCheck = editingCategory
      ? existingCategories.filter((cat) => cat.id !== editingCategory.id)
      : existingCategories;

    const similarCheck = findSimilarCategory(categoryName, categoriesToCheck);

    // Exact match found
    if (similarCheck.type === 'exact') {
      setValidationError(
        `A category named "${similarCheck.category!.name}" already exists. Please use a different name.`,
      );
      setConflictingCategory(similarCheck.category);
      toast.error('Duplicate category name');
      return;
    }

    // Similar match found (>=75% similarity)
    if (similarCheck.type === 'similar') {
      const similarityPercent = Math.round(similarCheck.similarity * 100);
      setValidationError(
        `This name is very similar to the existing category "${similarCheck.category!.name}" (${similarityPercent}% match). Please use a more distinct name.`,
      );
      setConflictingCategory(similarCheck.category);
      toast.error('Similar category name detected');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCategory) {
        // Update existing category
        const response = await updatePOSCategory(editingCategory.id, {
          name: categoryName,
          description: description || undefined,
        });
        toast.success('Category updated successfully!');
        await loadExistingCategories();
        onSuccess(response.data);

        // Clear form and exit edit mode
        setCategoryName('');
        setDescription('');
        setEditingCategory(null);
      } else {
        // Create new category
        const response = await createPOSCategory({
          name: categoryName,
          description: description || undefined,
        });
        toast.success('Category added successfully!');

        // Add new category to the list
        setExistingCategories([...existingCategories, response.data]);
        onSuccess(response.data);

        // Clear form but don't close modal (allows bulk adding)
        setCategoryName('');
        setDescription('');
      }
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.error(
        editingCategory
          ? 'Failed to update category. Please try again.'
          : 'Failed to add category. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle edit button click
   */
  const handleEditCategory = (category: POSCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setDescription(category.description || '');
    setValidationError('');
    setConflictingCategory(null);
  };

  /**
   * Handle delete button click
   */
  const handleDeleteCategory = (category: POSCategory) => {
    setCategoryToDelete(category);
    setShowDeleteConfirm(true);
  };

  /**
   * Confirm and execute category deletion
   */
  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      await deletePOSCategory(categoryToDelete.id);
      toast.success(`Category "${categoryToDelete.name}" deleted successfully`);

      // Refresh categories list
      await loadExistingCategories();

      // Close confirmation modal
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      toast.error(error.message || 'Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Cancel category deletion
   */
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setCategoryToDelete(null);
  };

  /**
   * Close modal and reset all state
   */
  const handleClose = () => {
    setCategoryName('');
    setDescription('');
    setIsSubmitting(false);
    setEditingCategory(null);
    setValidationError('');
    setConflictingCategory(null);
    onClose();
  };

  return (
    <>
      <Modal show={show} size="4xl" onClose={handleClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-white dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <FolderPlus className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Category Management
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {editingCategory
                      ? 'Edit existing category'
                      : 'Add new or edit existing categories'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* CONTENT (Two-Column Layout) */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* LEFT COLUMN - Add/Edit Form */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-primary-200 to-transparent dark:from-primary-800"></div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {editingCategory ? 'Edit Category' : 'New Category'}
                  </h4>
                  <div className="h-px flex-1 bg-gradient-to-l from-primary-200 to-transparent dark:from-primary-800"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Validation Error Display */}
                  {validationError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            {validationError}
                          </p>
                          {conflictingCategory && (
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                              Existing category has {conflictingCategory.product_count || 0}{' '}
                              product(s).
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category Name Input */}
                  <div>
                    <Label
                      htmlFor="category-name"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block"
                    >
                      Category Name <span className="text-red-500">*</span>
                    </Label>
                    <StandardTextInput
                      id="category-name"
                      placeholder="e.g., Digital Prints, Business Cards, Banners"
                      value={categoryName}
                      onChange={(e) => {
                        setCategoryName(e.target.value);
                        if (validationError) {
                          setValidationError('');
                          setConflictingCategory(null);
                        }
                      }}
                      required
                      autoFocus
                    />
                  </div>

                  {/* Description Input */}
                  <div>
                    <Label
                      htmlFor="category-desc"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block"
                    >
                      Description
                    </Label>
                    <StandardTextInput
                      id="category-desc"
                      placeholder="Brief description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      isProcessing={isSubmitting}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {editingCategory ? 'Update' : 'Add Category'}
                    </Button>
                    {editingCategory && (
                      <Button
                        type="button"
                        color="gray"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryName('');
                          setDescription('');
                          setValidationError('');
                          setConflictingCategory(null);
                        }}
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </form>
              </div>

              {/* RIGHT COLUMN - Existing Categories */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700"></div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    All Categories ({existingCategories.length})
                  </h4>
                  <div className="h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent dark:from-gray-700"></div>
                </div>

                {/* Category List */}
                {isLoadingCategories ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary-500" />
                    <p className="text-sm">Loading categories...</p>
                  </div>
                ) : existingCategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                    <Archive className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm">No categories yet</p>
                    <p className="text-xs mt-1">Add your first category to get started</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="h-[240px] overflow-y-auto thin-scrollbar">
                      {existingCategories.map((category) => {
                        const isConflicting = conflictingCategory?.id === category.id;
                        const isEditing = editingCategory?.id === category.id;

                        return (
                          <div
                            key={category.id}
                            className={`p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-all ${
                              isEditing
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-500'
                                : isConflicting
                                  ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500'
                                  : 'hover:bg-white dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5
                                    className={`font-semibold text-sm truncate ${
                                      isEditing
                                        ? 'text-primary-900 dark:text-primary-200'
                                        : isConflicting
                                          ? 'text-red-900 dark:text-red-200'
                                          : 'text-gray-900 dark:text-white'
                                    }`}
                                  >
                                    {category.name}
                                  </h5>
                                  {isEditing && (
                                    <Badge color="info" size="xs">
                                      Editing
                                    </Badge>
                                  )}
                                  {isConflicting && (
                                    <Badge color="failure" size="xs">
                                      Conflict
                                    </Badge>
                                  )}
                                </div>
                                {category.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                    {category.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <Package className="h-3 w-3" />
                                  <span>
                                    {category.product_count || 0} product
                                    {category.product_count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditCategory(category)}
                                  className="p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  title="Edit Category"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(category)}
                                  className="p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  title="Delete Category"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-end">
              <Button color="gray" onClick={handleClose} size="sm">
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && categoryToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    categoryToDelete.product_count > 0
                      ? 'bg-amber-100 dark:bg-amber-900/20'
                      : 'bg-red-100 dark:bg-red-900/20'
                  }`}
                >
                  <AlertTriangle
                    className={`h-6 w-6 ${
                      categoryToDelete.product_count > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {categoryToDelete.product_count > 0
                    ? 'Cannot Delete Category'
                    : 'Delete Category'}
                </h3>
                {categoryToDelete.product_count > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      The category <strong>"{categoryToDelete.name}"</strong> cannot be deleted
                      because it has {categoryToDelete.product_count} product(s) assigned to it.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                        To delete this category:
                      </p>
                      <ol className="text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
                        <li>Reassign all products to a different category, or</li>
                        <li>Remove/discontinue the products from this category</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Are you sure you want to delete the category{' '}
                      <strong>"{categoryToDelete.name}"</strong>?
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      This action cannot be undone.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {categoryToDelete.product_count > 0 ? (
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Spinner size="sm" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete Category
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
