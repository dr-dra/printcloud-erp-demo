using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PrintCloudClient.Models
{
    public class Printer
    {
        [JsonProperty("name")]
        public string Name { get; set; } = "";
        
        [JsonProperty("driver")]
        public string? Driver { get; set; }
        
        [JsonProperty("printer_type")]
        public string PrinterType { get; set; } = "standard"; // "standard" or "pos"
        
        [JsonProperty("status")]
        public string Status { get; set; } = "online"; // "online", "offline", "error", "busy"
        
        [JsonProperty("capabilities")]
        public Dictionary<string, object> Capabilities { get; set; } = new Dictionary<string, object>();
        
        [JsonProperty("last_status_update")]
        public DateTime LastStatusUpdate { get; set; } = DateTime.Now;
        
        public bool IsOnline => Status.Equals("online", StringComparison.OrdinalIgnoreCase);
        
        public bool IsStandardPrinter => PrinterType.Equals("standard", StringComparison.OrdinalIgnoreCase);
        
        public bool IsPosPrinter => PrinterType.Equals("pos", StringComparison.OrdinalIgnoreCase);
        
        public override string ToString()
        {
            return $"{Name} ({PrinterType} - {Status})";
        }
        
        public override bool Equals(object? obj)
        {
            return obj is Printer printer && Name.Equals(printer.Name, StringComparison.OrdinalIgnoreCase);
        }
        
        public override int GetHashCode()
        {
            return Name.GetHashCode();
        }
    }
}