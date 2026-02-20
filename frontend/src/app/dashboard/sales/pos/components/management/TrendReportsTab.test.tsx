import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TrendReportsTab } from './TrendReportsTab';
import { api } from '@/lib/api';

// Note: This test requires @testing-library/react, @testing-library/jest-dom, and jest/vitest to run.
// Ensure devDependencies are installed.

// Mock the API module
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

// Mock react-apexcharts
jest.mock('react-apexcharts', () => ({
  __esModule: true,
  default: () => <div data-testid="apex-chart">Chart</div>,
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light' }),
}));

// Mock dynamic import
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => <div data-testid="apex-chart">Chart</div>;
  return DynamicComponent;
});

describe('TrendReportsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with title and controls', () => {
    render(<TrendReportsTab />);

    expect(screen.getByText('Monthly Sales Trend')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  it('calls the API automatically on mount with default dates', async () => {
    // Mock API response
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        current: [1000, 2000, 1500, 3000, 2500, 4000],
      },
    });

    render(<TrendReportsTab />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/pos/orders/monthly_sales_report/'),
      );
    });
  });

  it('displays chart after successful data fetch', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        labels: ['Jan', 'Feb'],
        current: [1000, 2000],
      },
    });

    render(<TrendReportsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
    });
  });

  it('displays error message on API failure', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<TrendReportsTab />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load sales report/i)).toBeInTheDocument();
    });
  });
});
/* global describe, it, expect, jest, beforeEach */
