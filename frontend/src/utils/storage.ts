export const getStorageKey = (uniqueId: string, key: string) => `datatable_${uniqueId}_${key}`;

export const loadFromStorage = <T>(uniqueId: string, key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(getStorageKey(uniqueId, key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const saveToStorage = (uniqueId: string, key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(uniqueId, key), JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
};
