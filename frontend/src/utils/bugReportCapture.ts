export async function captureBugReportScreenshot(): Promise<{
  file: File | null;
  error: string | null;
}> {
  try {
    if (typeof window === 'undefined') {
      return { file: null, error: 'Screenshot capture is not available.' };
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: window.devicePixelRatio || 1,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('Failed to capture screenshot.'));
      }, 'image/png');
    });

    const file = new File([blob], `bug-report-${Date.now()}.png`, { type: 'image/png' });
    return { file, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to capture screenshot.';
    return { file: null, error: message };
  }
}
