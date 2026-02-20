using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PrintCloudClient.Models
{
    public class PrintJob
    {
        [JsonProperty("id")]
        public string Id { get; set; } = "";
        
        [JsonProperty("target_printer_name")]
        public string TargetPrinterName { get; set; } = "";
        
        [JsonProperty("fallback_printer_names")]
        public List<string> FallbackPrinterNames { get; set; } = new List<string>();
        
        [JsonProperty("document_type")]
        public string DocumentType { get; set; } = ""; // "invoice", "quotation", "receipt", "job_ticket", "dispatch_note"
        
        [JsonProperty("print_data")]
        public string PrintData { get; set; } = ""; // Base64 encoded PDF content or ESC/POS commands
        
        [JsonProperty("copies")]
        public int Copies { get; set; } = 1;
        
        [JsonProperty("status")]
        public string Status { get; set; } = "assigned";
        
        [JsonProperty("user")]
        public int UserId { get; set; }
        
        [JsonProperty("created_at")]
        public DateTime CreatedAt { get; set; }
        
        public bool IsReceiptJob => DocumentType.Equals("receipt", StringComparison.OrdinalIgnoreCase);
        
        public bool IsDocumentJob => !IsReceiptJob;
        
        public bool IsPdfDocument
        {
            get
            {
                try
                {
                    var data = GetPrintDataBytes();
                    if (data == null || data.Length < 5) return false;
                    var header = System.Text.Encoding.ASCII.GetString(data, 0, Math.Min(data.Length, 10));
                    return header.StartsWith("%PDF-", StringComparison.OrdinalIgnoreCase);
                }
                catch
                {
                    return false;
                }
            }
        }
        
        public byte[] GetPrintDataBytes()
        {
            try
            {
                return Convert.FromBase64String(PrintData);
            }
            catch
            {
                return System.Text.Encoding.UTF8.GetBytes(PrintData);
            }
        }
        
        public string GetPreferredPrinterType()
        {
            if (IsReceiptJob && IsPdfDocument)
            {
                return "standard";
            }
            return IsReceiptJob ? "pos" : "standard";
        }
        
        public List<string> GetAllPrinterOptions()
        {
            var options = new List<string>();
            if (!string.IsNullOrEmpty(TargetPrinterName))
                options.Add(TargetPrinterName);
            options.AddRange(FallbackPrinterNames);
            return options;
        }
        
        public override string ToString()
        {
            return $"Job {Id} - {DocumentType} ({Copies} copies) -> {TargetPrinterName}";
        }
    }
}
