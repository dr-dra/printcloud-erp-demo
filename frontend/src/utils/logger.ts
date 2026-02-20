const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

export const debugLog = (...args: unknown[]) => {
  if (isDebugEnabled) {
    console.log(...args);
  }
};

export const debugWarn = (...args: unknown[]) => {
  if (isDebugEnabled) {
    console.warn(...args);
  }
};
