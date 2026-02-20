/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Example usage of usePageInitialization hook
 * This file demonstrates how to use the hook in different scenarios
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from 'react';
import { usePageInitialization } from './usePageInitialization';

// Example 1: Basic usage with default settings
export const BasicExample = () => {
  const {
    pageReady,
    loading,
    calculatedRowsPerPage,
    setRowsPerPage,
    topNavRef,
    titleRef,
    filterBarRef,
    paginationRef,
    tableRef,
  } = usePageInitialization();

  const [data, setData] = useState([]);

  // Fetch data when page is ready
  useEffect(() => {
    if (pageReady && !loading) {
      fetchData(calculatedRowsPerPage);
    }
  }, [pageReady, loading, calculatedRowsPerPage]);

  const fetchData = async (pageSize: number) => {
    // Your data fetching logic here
    console.log(`Fetching ${pageSize} items`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div ref={topNavRef} />
      <div ref={titleRef}>Page Title</div>
      <div ref={filterBarRef}>Filters</div>
      <div ref={tableRef}>
        {/* Your table component */}
        <p>Showing {calculatedRowsPerPage} rows per page</p>
      </div>
      <div ref={paginationRef} />
    </div>
  );
};

// Example 2: Custom configuration
export const CustomConfigExample = () => {
  const {
    pageReady,
    loading,
    calculatedRowsPerPage,
    setRowsPerPage,
    recalculateRows,
    resetPage,
    // ... other properties
  } = usePageInitialization({
    rowHeight: 60, // Smaller rows
    minRows: 10, // Minimum 10 rows
    maxRows: 100, // Maximum 100 rows
    padding: 20, // Less padding
    defaultRowsPerPage: 25,
    initializationDelay: 200, // Longer delay
    resizeDebounceDelay: 300, // Longer debounce
    onInitializationComplete: () => {
      console.log('Custom page initialized!');
    },
    onError: (error) => {
      console.error('Custom page error:', error);
    },
  });

  return (
    <div>
      <button onClick={() => setRowsPerPage('auto')}>Auto</button>
      <button onClick={() => setRowsPerPage(25)}>25 rows</button>
      <button onClick={() => setRowsPerPage(50)}>50 rows</button>
      <button onClick={recalculateRows}>Recalculate</button>
      <button onClick={resetPage}>Reset</button>
      <p>Current: {calculatedRowsPerPage} rows</p>
    </div>
  );
};

// Example 3: Disabled auto-calculation
export const DisabledAutoExample = () => {
  const {
    pageReady,
    loading,
    calculatedRowsPerPage,
    setRowsPerPage,
    // ... other properties
  } = usePageInitialization({
    enableAutoCalculation: false, // Disable auto-calculation
    defaultRowsPerPage: 20,
  });

  return (
    <div>
      <select onChange={(e) => setRowsPerPage(Number(e.target.value))}>
        <option value={10}>10 rows</option>
        <option value={20}>20 rows</option>
        <option value={50}>50 rows</option>
      </select>
      <p>Fixed: {calculatedRowsPerPage} rows</p>
    </div>
  );
};

// Example 4: Integration with data fetching
export const DataFetchingExample = () => {
  const {
    pageReady,
    loading: pageLoading,
    calculatedRowsPerPage,
    setRowsPerPage,
    topNavRef,
    titleRef,
    filterBarRef,
    paginationRef,
    tableRef,
  } = usePageInitialization({
    onInitializationComplete: () => console.log('Ready to fetch data'),
  });

  const [data, setData] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch data when page is ready and rows change
  useEffect(() => {
    if (pageReady && !pageLoading) {
      fetchData();
    }
  }, [pageReady, pageLoading, calculatedRowsPerPage, currentPage]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Your API call here
      const response = await fetch(
        `/api/data?page=${currentPage}&page_size=${calculatedRowsPerPage}`,
      );
      const result = await response.json();
      setData(result.data);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  if (pageLoading) {
    return <div>Initializing page...</div>;
  }

  return (
    <div>
      <div ref={topNavRef} />
      <div ref={titleRef}>
        <h1>Data Table</h1>
      </div>

      <div ref={filterBarRef}>
        <button onClick={() => setRowsPerPage('auto')}>Auto</button>
        <button onClick={() => setRowsPerPage(10)}>10</button>
        <button onClick={() => setRowsPerPage(25)}>25</button>
        <button onClick={() => setRowsPerPage(50)}>50</button>
      </div>

      <div ref={tableRef}>
        {dataLoading ? (
          <div>Loading data...</div>
        ) : (
          <div>
            {data.map((item: any) => (
              <div key={item.id}>{item.name}</div>
            ))}
          </div>
        )}
      </div>

      <div ref={paginationRef}>
        <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

// Example 5: Error handling
export const ErrorHandlingExample = () => {
  const {
    pageReady,
    loading,
    error,
    setError,
    resetPage,
    // ... other properties
  } = usePageInitialization({
    onError: (error) => {
      console.error('Page initialization failed:', error);
      // You could show a toast notification here
    },
  });

  const handleRetry = () => {
    setError(null);
    resetPage();
  };

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={handleRetry}>Retry</button>
      </div>
    );
  }

  return <div>Page content</div>;
};
