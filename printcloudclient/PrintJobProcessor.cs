using System;
using System.Collections.Generic;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using PrintCloudClient.Models;

namespace PrintCloudClient
{
    public class PrintJobProcessor
    {
        private readonly PrinterManager _printerManager;
        private readonly ApiClient _apiClient;

        private static readonly SemaphoreSlim PrinterSelectionSemaphore = new SemaphoreSlim(1, 1);
        
        public event EventHandler<JobProcessedEventArgs>? JobProcessed;
        
        public PrintJobProcessor(PrinterManager printerManager, ApiClient apiClient)
        {
            _printerManager = printerManager;
            _apiClient = apiClient;
        }
        
        public async Task<bool> ProcessJobAsync(PrintJob job)
        {
            Logger.LogInfo($"Processing print job: {job}");
            
            Printer? selectedPrinter = null;
            
            try
            {
                // Find the best available printer for this job
                selectedPrinter = FindBestPrinter(job);
                
                if (selectedPrinter == null)
                {
                    var userFriendlyError = GetUserFriendlyErrorMessage(job, "no_printer");
                    Logger.LogWarning($"No suitable printer found for job {job.Id}: {userFriendlyError}");
                    await _apiClient.CompleteJobAsync(job.Id, false, userFriendlyError);
                    NotifyJobProcessed(job, false, userFriendlyError);
                    return false;
                }
                
                Logger.LogInfo($"Selected printer: {selectedPrinter.Name} for job {job.Id}");
                
                // Process the job based on type
                bool success;
                string? errorMessage = null;
                
                if (job.IsReceiptJob && !job.IsPdfDocument)
                {
                    success = await ProcessReceiptJobAsync(job, selectedPrinter);
                    errorMessage = success ? null : GetUserFriendlyErrorMessage(job, "print_failed");
                }
                else
                {
                    success = await ProcessDocumentJobAsync(job, selectedPrinter);
                    errorMessage = success ? null : GetUserFriendlyErrorMessage(job, "print_failed");
                }
                
                // Report back to API
                await _apiClient.CompleteJobAsync(job.Id, success, errorMessage, selectedPrinter.Name);
                
                // Notify UI
                NotifyJobProcessed(job, success, errorMessage, selectedPrinter.Name);
                
                Logger.LogInfo($"Job {job.Id} {(success ? "completed successfully" : "failed")}");
                return success;
            }
            catch (Exception ex)
            {
                var errorType = CategorizePrintError(ex, selectedPrinter?.Name ?? "unknown");
                var userFriendlyError = GetUserFriendlyErrorMessage(job, errorType);
                
                Logger.LogError($"Exception processing job {job.Id}: {ex.Message}", ex);
                
                await _apiClient.CompleteJobAsync(job.Id, false, userFriendlyError);
                NotifyJobProcessed(job, false, userFriendlyError);
                return false;
            }
        }
        
        private Printer? FindBestPrinter(PrintJob job)
        {
            var availablePrinters = _printerManager.GetOnlinePrinters();
            var preferredType = job.GetPreferredPrinterType();
            
            // Filter by printer type first
            var compatiblePrinters = availablePrinters.Where(p => 
                p.PrinterType.Equals(preferredType, StringComparison.OrdinalIgnoreCase)).ToList();
            
            if (!compatiblePrinters.Any())
            {
                Logger.LogWarning($"No {preferredType} printers available for job {job.Id}");
                
                // Show user-friendly error for POS printers
                if (preferredType == "pos")
                {
                    ShowPrinterSelectionDialog(job, availablePrinters, "No compatible POS/thermal printers found");
                }
                
                return null;
            }
            
            // Try to find the user's preferred printer first
            var printerOptions = job.GetAllPrinterOptions();
            
            foreach (var printerName in printerOptions)
            {
                var printer = compatiblePrinters.FirstOrDefault(p => 
                    p.Name.Equals(printerName, StringComparison.OrdinalIgnoreCase));
                
                if (printer != null && printer.IsOnline)
                {
                    Logger.LogInfo($"Found preferred printer: {printer.Name}");
                    return printer;
                }
            }
            
            // User's preferred printer not available - show selection dialog
            Logger.LogInfo($"User's preferred printer not available for job {job.Id} - showing selection dialog");
            return ShowPrinterSelectionDialog(job, compatiblePrinters);
        }
        
        private Printer? ShowPrinterSelectionDialog(PrintJob job, List<Printer> availablePrinters, string? errorMessage = null)
        {
            var acquired = false;
            try
            {
                acquired = PrinterSelectionSemaphore.Wait(5000);
                if (!acquired)
                {
                    Logger.LogWarning("Printer selection dialog already open - skipping prompt");
                    return null;
                }

                // Must run on UI thread
                if (System.Windows.Forms.Application.OpenForms.Count == 0)
                {
                    Logger.LogWarning("No UI available for printer selection dialog");
                    return null;
                }
                
                Printer? selectedPrinter = null;
                int selectedCopies = job.Copies;
                
                // Use Invoke to ensure we're on the UI thread
                var mainForm = System.Windows.Forms.Application.OpenForms.OfType<MainForm>().FirstOrDefault();
                if (mainForm != null)
                {
                    mainForm.Invoke(new Action(() =>
                    {
                        using var dialog = new PrinterSelectionDialog();
                        
                        var originalPrinterName = job.TargetPrinterName;
                        if (string.IsNullOrEmpty(originalPrinterName) && job.FallbackPrinterNames.Any())
                        {
                            originalPrinterName = job.FallbackPrinterNames.First();
                        }
                        
                        dialog.ConfigureDialog(job.DocumentType, originalPrinterName, availablePrinters, job.Copies, job.GetPreferredPrinterType());
                        
                        if (!string.IsNullOrEmpty(errorMessage))
                        {
                            // Could enhance dialog to show custom error message
                            Logger.LogWarning($"Printer selection dialog: {errorMessage}");
                        }
                        
                        var result = dialog.ShowDialog(mainForm);
                        
                        if (result == System.Windows.Forms.DialogResult.OK && dialog.UserConfirmed)
                        {
                            selectedPrinter = dialog.SelectedPrinter;
                            selectedCopies = dialog.Copies;
                            
                            // Update the job with the new copy count if changed
                            if (selectedCopies != job.Copies)
                            {
                                Logger.LogInfo($"User changed copy count from {job.Copies} to {selectedCopies} for job {job.Id}");
                                job.Copies = selectedCopies;
                            }
                            
                            Logger.LogInfo($"User selected printer: {selectedPrinter?.Name} for job {job.Id}");
                        }
                        else
                        {
                            Logger.LogInfo($"User cancelled printer selection for job {job.Id}");
                        }
                    }));
                }
                
                return selectedPrinter;
            }
            catch (Exception ex)
            {
                Logger.LogError("Error showing printer selection dialog", ex);
                return null;
            }
            finally
            {
                if (acquired)
                {
                    PrinterSelectionSemaphore.Release();
                }
            }
        }
        
        private async Task<bool> ProcessDocumentJobAsync(PrintJob job, Printer printer)
        {
            return await Task.Run(() => ProcessDocumentJob(job, printer));
        }
        
        private bool ProcessDocumentJob(PrintJob job, Printer printer)
        {
            try
            {
                var printData = job.GetPrintDataBytes();
                
                Logger.LogInfo($"Processing document job {job.Id} with {printData.Length} bytes for printer {printer.Name}");
                
                // Check if printer is available before attempting to print
                if (!IsPrinterAvailable(printer.Name))
                {
                    Logger.LogError($"Printer {printer.Name} is not available or offline");
                    return false;
                }
                
                if (IsPdfData(printData))
                {
                    var isVirtual = IsPdfVirtualPrinter(printer.Name);
                    Logger.LogInfo($"PDF data detected for printer {printer.Name} (virtual: {isVirtual})");

                    var sumatraPath = GetSumatraPdfPath();
                    if (!string.IsNullOrWhiteSpace(sumatraPath))
                    {
                        return HandlePdfPrintWithSumatra(printData, printer.Name, job.Copies, sumatraPath);
                    }

                    Logger.LogInfo("SumatraPDF not found, falling back to Windows shell print");
                    return HandlePdfPrintWithShell(printData, printer.Name, job.Copies);
                }
                
                // For physical printers, use raw data approach
                Logger.LogInfo($"Physical printer detected: {printer.Name}, using raw data approach");
                return SendRawDataToPrinter(printer.Name, printData, job.Copies);
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error processing document job", ex);
                return false;
            }
        }
        
        private async Task<bool> ProcessReceiptJobAsync(PrintJob job, Printer printer)
        {
            return await Task.Run(() => ProcessReceiptJob(job, printer));
        }
        
        private bool ProcessReceiptJob(PrintJob job, Printer printer)
        {
            try
            {
                var printData = job.GetPrintDataBytes();
                
                // For thermal/POS printers, send raw ESC/POS commands
                return SendRawDataToPrinter(printer.Name, printData, job.Copies);
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error processing receipt job", ex);
                return false;
            }
        }
        
        
        private bool IsPostScriptData(byte[] data)
        {
            // Check if data starts with PostScript magic bytes: %!PS-Adobe
            if (data == null || data.Length < 10) return false;
            
            var header = System.Text.Encoding.ASCII.GetString(data, 0, Math.Min(data.Length, 20));
            return header.StartsWith("%!PS-Adobe", StringComparison.OrdinalIgnoreCase);
        }
        
        private bool IsPdfData(byte[] data)
        {
            // Check if data starts with PDF magic bytes: %PDF-
            if (data == null || data.Length < 5) return false;
            
            var header = System.Text.Encoding.ASCII.GetString(data, 0, Math.Min(data.Length, 10));
            return header.StartsWith("%PDF-", StringComparison.OrdinalIgnoreCase);
        }
        
        private bool IsPdfVirtualPrinter(string printerName)
        {
            // Detect common PDF virtual printers
            var pdfPrinterIndicators = new[]
            {
                "Microsoft Print to PDF",
                "Adobe PDF",
                "PDF Creator",
                "CutePDF",
                "Foxit PDF",
                "PDF24",
                "Print to PDF",
                "Save as PDF",
                "PDF Printer"
            };
            
            return pdfPrinterIndicators.Any(indicator => 
                printerName.Contains(indicator, StringComparison.OrdinalIgnoreCase));
        }
        
        private bool HandlePdfVirtualPrinter(byte[] printData, string printerName, int copies)
        {
            try
            {
                Logger.LogInfo($"Handling PDF virtual printer: {printerName}");
                return HandlePdfPrintWithShell(printData, printerName, copies);
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error handling PDF virtual printer {printerName}", ex);
                return false;
            }
        }

        private bool HandlePdfPrintWithShell(byte[] printData, string printerName, int copies)
        {
            try
            {
                Logger.LogInfo($"Printing PDF via shell to printer: {printerName}");
                
                // For PDF virtual printers, create a temporary file and use the shell to print
                var tempFile = Path.GetTempFileName();
                var pdfFile = Path.ChangeExtension(tempFile, ".pdf");
                
                try
                {
                    // Write the print data to a temporary file
                    File.WriteAllBytes(pdfFile, printData);
                    
                    Logger.LogInfo($"Created temporary PDF file: {pdfFile} ({printData.Length} bytes)");
                    
                    // Use Windows shell to print the PDF to the virtual printer
                    for (int i = 0; i < copies; i++)
                    {
                        var success = PrintPdfFileToVirtualPrinter(pdfFile, printerName);
                        if (!success)
                        {
                            Logger.LogError($"Failed to print copy {i + 1} to {printerName}");
                            return false;
                        }
                        
                        // Small delay between copies
                        if (i < copies - 1)
                        {
                            System.Threading.Thread.Sleep(500);
                        }
                    }
                    
                    Logger.LogInfo($"Successfully printed {copies} copies to {printerName}");
                    return true;
                }
                finally
                {
                    // Clean up temporary files with delay for PDF virtual printers
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            // Wait a bit before cleanup to allow PDF viewer to access the file
                            await Task.Delay(5000);
                            
                            if (File.Exists(tempFile)) File.Delete(tempFile);
                            if (File.Exists(pdfFile)) File.Delete(pdfFile);
                            
                            Logger.LogDebug($"Cleaned up temporary PDF files after delay");
                        }
                        catch (Exception cleanupEx)
                        {
                            Logger.LogWarning($"Failed to clean up temp files: {cleanupEx.Message}");
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error printing PDF via shell for {printerName}", ex);
                return false;
            }
        }

        private bool HandlePdfPrintWithSumatra(byte[] printData, string printerName, int copies, string sumatraPath)
        {
            try
            {
                Logger.LogInfo($"Printing PDF via SumatraPDF to printer: {printerName}");

                var tempFile = Path.GetTempFileName();
                var pdfFile = Path.ChangeExtension(tempFile, ".pdf");

                try
                {
                    File.WriteAllBytes(pdfFile, printData);
                    Logger.LogInfo($"Created temporary PDF file: {pdfFile} ({printData.Length} bytes)");

                    for (int i = 0; i < copies; i++)
                    {
                        var success = PrintPdfFileWithSumatra(pdfFile, printerName, sumatraPath);
                        if (!success)
                        {
                            Logger.LogError($"Failed to print copy {i + 1} to {printerName} using SumatraPDF");
                            return false;
                        }

                        if (i < copies - 1)
                        {
                            System.Threading.Thread.Sleep(500);
                        }
                    }

                    Logger.LogInfo($"Successfully printed {copies} copies to {printerName} using SumatraPDF");
                    return true;
                }
                finally
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await Task.Delay(5000);
                            if (File.Exists(tempFile)) File.Delete(tempFile);
                            if (File.Exists(pdfFile)) File.Delete(pdfFile);
                            Logger.LogDebug("Cleaned up temporary PDF files after delay");
                        }
                        catch (Exception cleanupEx)
                        {
                            Logger.LogWarning($"Failed to clean up temp files: {cleanupEx.Message}");
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error printing PDF via SumatraPDF for {printerName}", ex);
                return false;
            }
        }

        private bool PrintPdfFileWithSumatra(string pdfFilePath, string printerName, string sumatraPath)
        {
            try
            {
                Logger.LogInfo($"Printing PDF file {pdfFilePath} via SumatraPDF to {printerName}");

                var arguments =
                    $"-print-to \"{printerName}\" -print-settings \"noscale\" -silent -exit-on-print \"{pdfFilePath}\"";

                var startInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = sumatraPath,
                    Arguments = arguments,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
                };

                using var process = System.Diagnostics.Process.Start(startInfo);
                if (process == null)
                {
                    Logger.LogError("Failed to start SumatraPDF process");
                    return false;
                }

                if (!process.WaitForExit(30000))
                {
                    Logger.LogWarning("SumatraPDF print process timed out");
                    return false;
                }

                if (process.ExitCode != 0)
                {
                    Logger.LogError($"SumatraPDF exited with code {process.ExitCode}");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                Logger.LogError("Error running SumatraPDF print command", ex);
                return false;
            }
        }

        private string GetSumatraPdfPath()
        {
            try
            {
                var baseDir = AppContext.BaseDirectory;
                var candidate = Path.Combine(baseDir, "SumatraPDF.exe");
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch (Exception ex)
            {
                Logger.LogWarning($"Failed to resolve SumatraPDF path: {ex.Message}");
            }

            return string.Empty;
        }
        
        private bool PrintPdfFileToVirtualPrinter(string pdfFilePath, string printerName)
        {
            try
            {
                Logger.LogInfo($"Printing PDF file {pdfFilePath} to virtual printer {printerName}");
                
                var startInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = pdfFilePath,
                    Verb = "printto",
                    Arguments = $"\"{printerName}\"",
                    UseShellExecute = true,
                    CreateNoWindow = true,
                    WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
                };
                
                using var process = System.Diagnostics.Process.Start(startInfo);
                if (process != null)
                {
                    // For PDF virtual printers, we don't need to wait for the process to complete
                    // The process starts the save dialog and that's considered success
                    Logger.LogInfo($"PDF print process started successfully for {printerName}");
                    
                    // Give it a moment to start up
                    System.Threading.Thread.Sleep(1000);
                    
                    // Check if process is still running or has completed successfully
                    if (process.HasExited)
                    {
                        Logger.LogInfo($"PDF print process completed with exit code: {process.ExitCode}");
                        // Exit code 0 or 1 can both be success for PDF virtual printers
                        return process.ExitCode <= 1;
                    }
                    else
                    {
                        Logger.LogInfo("PDF print process is running (save dialog opened)");
                        return true; // Process is running, which means save dialog opened successfully
                    }
                }
                else
                {
                    Logger.LogError("Failed to start PDF print process");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error printing PDF file to virtual printer {printerName}", ex);
                return false;
            }
        }
        
        private bool IsPrinterAvailable(string printerName)
        {
            try
            {
                var availablePrinters = _printerManager.GetOnlinePrinters();
                return availablePrinters.Any(p => p.Name.Equals(printerName, StringComparison.OrdinalIgnoreCase) && p.IsOnline);
            }
            catch (Exception ex)
            {
                Logger.LogWarning($"Error checking printer availability: {ex.Message}");
                return false; // Assume offline if we can't check
            }
        }
        
        private bool SendRawDataToPrinter(string printerName, byte[] data, int copies)
        {
            try
            {
                Logger.LogInfo($"Sending {data.Length} bytes to printer {printerName} ({copies} copies)");
                
                var rawPrintHelper = new RawPrinterHelper();
                
                for (int i = 0; i < copies; i++)
                {
                    if (!rawPrintHelper.SendBytesToPrinter(printerName, data))
                    {
                        Logger.LogError($"Failed to send raw data to printer {printerName} (copy {i + 1})");
                        return false;
                    }
                    
                    // Small delay between copies to avoid spooler overload
                    if (i < copies - 1)
                    {
                        System.Threading.Thread.Sleep(100);
                    }
                }
                
                Logger.LogInfo($"Successfully sent {data.Length} bytes to printer {printerName} ({copies} copies)");
                return true;
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error sending raw data to printer", ex);
                return false;
            }
        }
        
        private string GetUserFriendlyErrorMessage(PrintJob job, string errorType)
        {
            return errorType switch
            {
                "no_printer" => job.DocumentType switch
                {
                    "receipt" => job.GetPreferredPrinterType() == "pos"
                        ? "No thermal/POS printers are currently online. Please check your receipt printer connection and try again."
                        : "No standard printers are available. Please ensure your printer is turned on and connected.",
                    "invoice" => "No standard printers are available. Please ensure your printer is turned on and connected.",
                    "quotation" => "No standard printers are available. Please ensure your printer is turned on and connected.",
                    "job_ticket" => "No standard printers are available for printing job tickets. Please check your printer connection.",
                    "dispatch_note" => "No printers are available for dispatch notes. Please verify your printer is online.",
                    _ => "No compatible printers are currently available. Please check your printer connections and try again."
                },
                "printer_offline" => $"The printer '{job.TargetPrinterName}' is offline or unavailable. Please check the printer status and connection.",
                "print_failed" => job.DocumentType switch
                {
                    "receipt" => job.GetPreferredPrinterType() == "pos"
                        ? "Failed to print receipt. Please check the thermal printer paper and connection."
                        : "Document failed to print. Please ensure the printer has paper and is ready to print.",
                    _ => "Document failed to print. Please ensure the printer has paper and is ready to print."
                },
                "connection_error" => "Unable to connect to the print server. Please check your network connection and try again.",
                "permission_error" => "Access denied to the printer. Please ensure you have permission to print to this device.",
                "paper_jam" => "Printer has a paper jam or other hardware issue. Please check the printer status.",
                "out_of_paper" => "Printer is out of paper. Please refill the paper tray and try again.",
                "driver_error" => "Printer driver issue detected. Please reinstall the printer driver or contact IT support.",
                _ => "An unexpected error occurred during printing. Please try again or contact support."
            };
        }
        
        private string CategorizePrintError(Exception ex, string printerName)
        {
            var message = ex.Message.ToLowerInvariant();
            
            // Categorize common error types
            if (message.Contains("access") || message.Contains("denied") || message.Contains("permission"))
            {
                return "permission_error";
            }
            else if (message.Contains("offline") || message.Contains("not available"))
            {
                return "printer_offline";
            }
            else if (message.Contains("paper") && message.Contains("jam"))
            {
                return "paper_jam";
            }
            else if (message.Contains("out of paper") || message.Contains("no paper"))
            {
                return "out_of_paper";
            }
            else if (message.Contains("driver") || message.Contains("spooler"))
            {
                return "driver_error";
            }
            else if (message.Contains("network") || message.Contains("connection"))
            {
                return "connection_error";
            }
            else
            {
                return "print_failed";
            }
        }
        
        private void NotifyJobProcessed(PrintJob job, bool success, string? errorMessage = null, string? usedPrinterName = null)
        {
            try
            {
                var args = new JobProcessedEventArgs
                {
                    Job = job,
                    Success = success,
                    ErrorMessage = errorMessage,
                    UsedPrinterName = usedPrinterName
                };
                
                JobProcessed?.Invoke(this, args);
            }
            catch (Exception ex)
            {
                Logger.LogError("Error notifying job processed", ex);
            }
        }
    }
    
    public class JobProcessedEventArgs : EventArgs
    {
        public PrintJob Job { get; set; } = null!;
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
        public string? UsedPrinterName { get; set; }
    }
}
