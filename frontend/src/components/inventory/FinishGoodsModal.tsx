'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea, StandardSelect } from '@/components/common/inputs';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import {
  FinishedProduct,
  FinishedProductFormData,
  FinishedProductCategory,
} from '@/types/inventory';

interface FinishGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit' | 'view';
  product: FinishedProduct | null;
}

const schema = yup.object().shape({
  name: yup.string().required('Product name is required').min(1, 'Product name cannot be empty'),
  width: yup
    .number()
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value))
    .positive('Width must be positive')
    .max(9999, 'Width must be less than 10000mm'),
  height: yup
    .number()
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value))
    .positive('Height must be positive')
    .max(9999, 'Height must be less than 10000mm'),
  description: yup.string(),
  category: yup.number().required('Category is required'),
  is_active: yup.boolean(),
  is_vat_exempt: yup.boolean(),
});

export default function FinishGoodsModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  product,
}: FinishGoodsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<FinishedProductCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const isReadOnly = mode === 'view';
  const isEdit = mode === 'edit';

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FinishedProductFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      width: null,
      height: null,
      description: '',
      category: 0,
      is_active: true,
      is_vat_exempt: false,
    },
  });

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const response = await api.get('/sales/categories/?page_size=200');
        setCategories(response.data.results);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setCategoriesLoading(false);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (isOpen) {
      if (product && (mode === 'edit' || mode === 'view')) {
        reset({
          name: product.name,
          width: product.width,
          height: product.height,
          description: product.description,
          category: product.category,
          is_active: product.is_active,
          is_vat_exempt: product.is_vat_exempt,
        });
      } else {
        reset({
          name: '',
          width: null,
          height: null,
          description: '',
          category: categories[0]?.id || 0,
          is_active: true,
          is_vat_exempt: false,
        });
      }
      setError(null);
    }
  }, [isOpen, product, mode, reset, categories]);

  const handleFormSubmit = async (data: FinishedProductFormData) => {
    if (isReadOnly) return;

    setLoading(true);
    setError(null);

    try {
      if (isEdit && product) {
        await api.put(`/sales/finished-products/${product.id}/update/`, data);
      } else {
        await api.post('/sales/finished-products/create/', data);
      }
      onSuccess();
    } catch (err: any) {
      const errorMessage = getErrorMessage(
        err,
        `Failed to ${isEdit ? 'update' : 'create'} product. Please try again.`,
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const modalTitle = {
    create: 'Add New Finish Good',
    edit: 'Edit Finish Good',
    view: 'View Finish Good',
  }[mode];

  const submitButtonText = {
    create: 'Create Product',
    edit: 'Update Product',
    view: 'Close',
  }[mode];

  return (
    <Modal show={isOpen} onClose={handleClose} size="xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{modalTitle}</h3>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && <Alert color="failure">{error}</Alert>}

            {/* Product Name */}
            <div>
              <Label htmlFor="name" value="Product Name *" />
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <StandardTextInput
                    {...field}
                    id="name"
                    placeholder="Enter product name"
                    color={errors.name ? 'failure' : undefined}
                    helperText={errors.name?.message}
                    disabled={isReadOnly}
                  />
                )}
              />
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="width" value="Width (mm)" />
                <Controller
                  name="width"
                  control={control}
                  render={({ field }) => (
                    <StandardTextInput
                      {...field}
                      id="width"
                      type="number"
                      placeholder="Enter width in mm"
                      value={field.value || ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                      color={errors.width ? 'failure' : undefined}
                      helperText={errors.width?.message}
                      disabled={isReadOnly}
                      step="0.01"
                      min="0"
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor="height" value="Height (mm)" />
                <Controller
                  name="height"
                  control={control}
                  render={({ field }) => (
                    <StandardTextInput
                      {...field}
                      id="height"
                      type="number"
                      placeholder="Enter height in mm"
                      value={field.value || ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                      color={errors.height ? 'failure' : undefined}
                      helperText={errors.height?.message}
                      disabled={isReadOnly}
                      step="0.01"
                      min="0"
                    />
                  )}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category" value="Category *" />
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <StandardSelect
                    {...field}
                    id="category"
                    color={errors.category ? 'failure' : undefined}
                    helperText={errors.category?.message}
                    disabled={isReadOnly || categoriesLoading}
                  >
                    <option value="">StandardSelect a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.parent_category_name
                          ? `${category.parent_category_name} > ${category.category_name}`
                          : category.category_name}
                      </option>
                    ))}
                  </StandardSelect>
                )}
              />
              {categoriesLoading && (
                <p className="text-sm text-gray-500 mt-1">Loading categories...</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" value="Description" />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <StandardTextarea
                    {...field}
                    id="description"
                    placeholder="Enter product description (optional)"
                    rows={3}
                    disabled={isReadOnly}
                  />
                )}
              />
            </div>

            {/* VAT Exempt */}
            <div className="flex items-center">
              <Controller
                name="is_vat_exempt"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center">
                    <input
                      {...field}
                      id="is_vat_exempt"
                      type="checkbox"
                      checked={field.value}
                      disabled={isReadOnly}
                      className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="is_vat_exempt" className="ml-2" value="VAT Exempt" />
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      (Books, Newspapers, Educational materials)
                    </span>
                  </div>
                )}
              />
            </div>

            {/* Active Status */}
            {(mode === 'edit' || mode === 'view') && (
              <div className="flex items-center">
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center">
                      <input
                        {...field}
                        id="is_active"
                        type="checkbox"
                        checked={field.value}
                        disabled={isReadOnly}
                        className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <Label htmlFor="is_active" className="ml-2" value="Active" />
                    </div>
                  )}
                />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-800">
            <div className="flex justify-end gap-3">
              <Button color="gray" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>

              {!isReadOnly && (
                <Button
                  type="submit"
                  disabled={loading || categoriesLoading}
                  isProcessing={loading}
                  className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
                >
                  {submitButtonText}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
