using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PrintCloudClient.Models
{
    public class ClientRegistrationRequest
    {
        [JsonProperty("name")]
        public string Name { get; set; } = "";
        
        [JsonProperty("ip_address")]
        public string IpAddress { get; set; } = "";
        
        [JsonProperty("version")]
        public string Version { get; set; } = "";
        
        [JsonProperty("printers")]
        public List<Printer> Printers { get; set; } = new List<Printer>();
    }
    
    public class ClientRegistrationResponse
    {
        [JsonProperty("id")]
        public string Id { get; set; } = "";
        
        [JsonProperty("name")]
        public string Name { get; set; } = "";
        
        [JsonProperty("ip_address")]
        public string IpAddress { get; set; } = "";
        
        [JsonProperty("status")]
        public string Status { get; set; } = "";
        
        [JsonProperty("printers")]
        public List<Printer> Printers { get; set; } = new List<Printer>();
    }
    
    public class PrinterStatusUpdateRequest
    {
        [JsonProperty("client_id")]
        public string ClientId { get; set; } = "";
        
        [JsonProperty("printers")]
        public List<Printer> Printers { get; set; } = new List<Printer>();
    }
    
    public class PrintJobCompletionRequest
    {
        [JsonProperty("status")]
        public string Status { get; set; } = ""; // "completed" or "failed"
        
        [JsonProperty("error_message")]
        public string? ErrorMessage { get; set; }
        
        [JsonProperty("used_printer_name")]
        public string? UsedPrinterName { get; set; }
    }
    
    public class HeartbeatResponse
    {
        [JsonProperty("status")]
        public string Status { get; set; } = "";
        
        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; }
        
        [JsonProperty("pending_jobs_count")]
        public int PendingJobsCount { get; set; }
    }
    
    public class ApiResponse<T>
    {
        [JsonProperty("data")]
        public T? Data { get; set; }
        
        [JsonProperty("error")]
        public string? Error { get; set; }
        
        [JsonProperty("status")]
        public string Status { get; set; } = "";
        
        public bool IsSuccess => string.IsNullOrEmpty(Error) && !Status.Equals("error", StringComparison.OrdinalIgnoreCase);
    }
}