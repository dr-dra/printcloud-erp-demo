using System;
using System.Collections.Generic;
using System.Drawing.Printing;
using System.Linq;
using System.Management;
using System.Threading.Tasks;
using PrintCloudClient.Models;

namespace PrintCloudClient
{
    public class PrinterManager
    {
        private readonly object _lockObject = new object();
        private List<Printer> _discoveredPrinters = new List<Printer>();
        
        public event EventHandler<PrintersChangedEventArgs>? PrintersChanged;
        
        public List<Printer> GetDiscoveredPrinters()
        {
            lock (_lockObject)
            {
                return new List<Printer>(_discoveredPrinters);
            }
        }
        
        public async Task<List<Printer>> DiscoverPrintersAsync()
        {
            return await Task.Run(DiscoverPrinters);
        }
        
        private List<Printer> DiscoverPrinters()
        {
            var printers = new List<Printer>();
            
            try
            {
                // Get system printers using WMI
                var wmiPrinters = GetWmiPrinters();
                
                // Get .NET Framework printer list for validation
                var systemPrinters = GetSystemPrinters();
                
                // Merge and categorize printers
                foreach (var wmiPrinter in wmiPrinters)
                {
                    var printer = new Printer
                    {
                        Name = wmiPrinter.Name,
                        Driver = wmiPrinter.DriverName,
                        Status = GetPrinterStatus(wmiPrinter),
                        PrinterType = DeterminePrinterType(wmiPrinter),
                        Capabilities = GetPrinterCapabilities(wmiPrinter),
                        LastStatusUpdate = DateTime.Now
                    };
                    
                    printers.Add(printer);
                }
                
                // Update internal list and notify of changes
                UpdatePrintersList(printers);
                
                Logger.Log($"Discovered {printers.Count} printers", LogLevel.Info);
            }
            catch (Exception ex)
            {
                Logger.Log($"Error discovering printers: {ex.Message}", LogLevel.Error);
            }
            
            return printers;
        }
        
        private List<WmiPrinterInfo> GetWmiPrinters()
        {
            var printers = new List<WmiPrinterInfo>();
            
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_Printer");
                using var collection = searcher.Get();
                
                foreach (ManagementObject printer in collection)
                {
                    var printerInfo = new WmiPrinterInfo
                    {
                        Name = printer["Name"]?.ToString() ?? "",
                        DriverName = printer["DriverName"]?.ToString() ?? "",
                        PortName = printer["PortName"]?.ToString() ?? "",
                        ShareName = printer["ShareName"]?.ToString() ?? "",
                        Location = printer["Location"]?.ToString() ?? "",
                        Comment = printer["Comment"]?.ToString() ?? "",
                        PrinterStatus = Convert.ToUInt16(printer["PrinterStatus"] ?? 0),
                        WorkOffline = Convert.ToBoolean(printer["WorkOffline"] ?? false),
                        PrinterState = Convert.ToUInt32(printer["PrinterState"] ?? 0),
                        Shared = Convert.ToBoolean(printer["Shared"] ?? false),
                        Network = Convert.ToBoolean(printer["Network"] ?? false),
                        Local = Convert.ToBoolean(printer["Local"] ?? true)
                    };
                    
                    printers.Add(printerInfo);
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"Error getting WMI printers: {ex.Message}", LogLevel.Error);
            }
            
            return printers;
        }
        
        private List<string> GetSystemPrinters()
        {
            var printers = new List<string>();
            
            try
            {
                foreach (string printerName in PrinterSettings.InstalledPrinters)
                {
                    printers.Add(printerName);
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"Error getting system printers: {ex.Message}", LogLevel.Error);
            }
            
            return printers;
        }
        
        private string GetPrinterStatus(WmiPrinterInfo printerInfo)
        {
            if (printerInfo.WorkOffline)
                return "offline";
                
            // Printer status codes from WMI
            return printerInfo.PrinterStatus switch
            {
                1 => "online",    // Other
                2 => "online",    // Unknown
                3 => "online",    // Idle
                4 => "busy",      // Printing
                5 => "busy",      // Warmup
                6 => "error",     // Stopped Printing
                7 => "offline",   // Offline
                _ => "online"
            };
        }
        
        private string DeterminePrinterType(WmiPrinterInfo printerInfo)
        {
            var name = printerInfo.Name.ToLowerInvariant();
            var driver = printerInfo.DriverName.ToLowerInvariant();
            
            // Common thermal/POS printer indicators
            var posKeywords = new[] { "thermal", "pos", "receipt", "tm-", "rp-", "tsp-", "star", "epson tm", "citizen" };
            
            if (posKeywords.Any(keyword => name.Contains(keyword) || driver.Contains(keyword)))
                return "pos";
            
            return "standard";
        }
        
        private Dictionary<string, object> GetPrinterCapabilities(WmiPrinterInfo printerInfo)
        {
            var capabilities = new Dictionary<string, object>
            {
                ["is_network"] = printerInfo.Network,
                ["is_shared"] = printerInfo.Shared,
                ["is_local"] = printerInfo.Local,
                ["port_name"] = printerInfo.PortName,
                ["location"] = printerInfo.Location,
                ["comment"] = printerInfo.Comment
            };
            
            // Try to get more detailed capabilities
            try
            {
                var printerSettings = new PrinterSettings { PrinterName = printerInfo.Name };
                
                if (printerSettings.IsValid)
                {
                    capabilities["can_duplex"] = printerSettings.CanDuplex;
                    capabilities["supports_color"] = printerSettings.SupportsColor;
                    capabilities["maximum_copies"] = printerSettings.MaximumCopies;
                    
                    // Paper sizes
                    var paperSizes = new List<string>();
                    foreach (PaperSize paperSize in printerSettings.PaperSizes)
                    {
                        paperSizes.Add($"{paperSize.PaperName} ({paperSize.Width}x{paperSize.Height})");
                    }
                    capabilities["paper_sizes"] = paperSizes;
                    
                    // Resolutions
                    var resolutions = new List<string>();
                    foreach (PrinterResolution resolution in printerSettings.PrinterResolutions)
                    {
                        resolutions.Add($"{resolution.X}x{resolution.Y} {resolution.Kind}");
                    }
                    capabilities["resolutions"] = resolutions;
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"Error getting capabilities for {printerInfo.Name}: {ex.Message}", LogLevel.Warning);
            }
            
            return capabilities;
        }
        
        private void UpdatePrintersList(List<Printer> newPrinters)
        {
            List<Printer> previousPrinters;
            
            lock (_lockObject)
            {
                previousPrinters = new List<Printer>(_discoveredPrinters);
                _discoveredPrinters = new List<Printer>(newPrinters);
            }
            
            // Check if printers changed
            if (PrintersChanged != null && HasPrintersChanged(previousPrinters, newPrinters))
            {
                var args = new PrintersChangedEventArgs
                {
                    Printers = new List<Printer>(newPrinters),
                    AddedPrinters = GetAddedPrinters(previousPrinters, newPrinters),
                    RemovedPrinters = GetRemovedPrinters(previousPrinters, newPrinters)
                };
                
                PrintersChanged?.Invoke(this, args);
            }
        }
        
        private bool HasPrintersChanged(List<Printer> previous, List<Printer> current)
        {
            if (previous.Count != current.Count)
                return true;
                
            return !previous.All(p => current.Any(c => c.Name.Equals(p.Name, StringComparison.OrdinalIgnoreCase)));
        }
        
        private List<Printer> GetAddedPrinters(List<Printer> previous, List<Printer> current)
        {
            return current.Where(c => !previous.Any(p => p.Name.Equals(c.Name, StringComparison.OrdinalIgnoreCase))).ToList();
        }
        
        private List<Printer> GetRemovedPrinters(List<Printer> previous, List<Printer> current)
        {
            return previous.Where(p => !current.Any(c => c.Name.Equals(p.Name, StringComparison.OrdinalIgnoreCase))).ToList();
        }
        
        public Printer? FindPrinterByName(string printerName)
        {
            if (string.IsNullOrEmpty(printerName))
                return null;
                
            lock (_lockObject)
            {
                return _discoveredPrinters.FirstOrDefault(p => 
                    p.Name.Equals(printerName, StringComparison.OrdinalIgnoreCase));
            }
        }
        
        public List<Printer> GetPrintersByType(string printerType)
        {
            lock (_lockObject)
            {
                return _discoveredPrinters.Where(p => 
                    p.PrinterType.Equals(printerType, StringComparison.OrdinalIgnoreCase)).ToList();
            }
        }
        
        public List<Printer> GetOnlinePrinters()
        {
            lock (_lockObject)
            {
                return _discoveredPrinters.Where(p => p.IsOnline).ToList();
            }
        }
    }
    
    public class PrintersChangedEventArgs : EventArgs
    {
        public List<Printer> Printers { get; set; } = new List<Printer>();
        public List<Printer> AddedPrinters { get; set; } = new List<Printer>();
        public List<Printer> RemovedPrinters { get; set; } = new List<Printer>();
    }
    
    internal class WmiPrinterInfo
    {
        public string Name { get; set; } = "";
        public string DriverName { get; set; } = "";
        public string PortName { get; set; } = "";
        public string ShareName { get; set; } = "";
        public string Location { get; set; } = "";
        public string Comment { get; set; } = "";
        public ushort PrinterStatus { get; set; }
        public bool WorkOffline { get; set; }
        public uint PrinterState { get; set; }
        public bool Shared { get; set; }
        public bool Network { get; set; }
        public bool Local { get; set; }
    }
}