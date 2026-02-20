using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Net;
using System.Net.NetworkInformation;
using Newtonsoft.Json;
using PrintCloudClient.Models;

namespace PrintCloudClient
{
    public class ApiClient : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private string? _clientId;
        private bool _disposed = false;
        
        // Connection retry logic
        private bool _isRetrying = false;
        private int _retryAttempt = 0;
        private DateTime _lastRetryTime = DateTime.MinValue;
        private readonly int[] _retryIntervals = { 30, 60, 120, 240, 300 }; // seconds: 30s, 1m, 2m, 4m, 5m
        private System.Timers.Timer? _retryTimer;
        
        public string? ClientId => _clientId;
        public bool IsRegistered => !string.IsNullOrEmpty(_clientId);
        public bool IsRetrying => _isRetrying;
        public int RetryAttempt => _retryAttempt;
        public DateTime NextRetryTime => _lastRetryTime.AddSeconds(_retryIntervals[Math.Min(_retryAttempt, _retryIntervals.Length - 1)]);
        public int SecondsUntilNextRetry => Math.Max(0, (int)(NextRetryTime - DateTime.Now).TotalSeconds);
        
        public event EventHandler<ConnectionStatusChangedEventArgs>? ConnectionStatusChanged;
        public event EventHandler<RetryStatusChangedEventArgs>? RetryStatusChanged;
        
        public ApiClient(string baseUrl)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
            _httpClient.DefaultRequestHeaders.Add("User-Agent", AppInfo.UserAgent);
        }
        
        public async Task<bool> RegisterClientAsync(string computerName, List<Printer> printers, string version = AppInfo.Version)
        {
            try
            {
                var localIpAddress = GetLocalIpAddress();
                if (string.IsNullOrEmpty(localIpAddress))
                {
                    Logger.LogError("Could not determine local IP address");
                    return false;
                }
                
                var request = new ClientRegistrationRequest
                {
                    Name = computerName,
                    IpAddress = localIpAddress,
                    Version = version,
                    Printers = printers
                };
                
                Logger.LogInfo($"Registering client: {computerName} at {localIpAddress}");
                
                var response = await PostAsync<ClientRegistrationResponse>("/register/", request);
                
                if (response != null)
                {
                    _clientId = response.Id;
                    Logger.LogInfo($"Client registered successfully with ID: {_clientId}");
                    NotifyConnectionStatusChanged(true);
                    return true;
                }
                else
                {
                    Logger.LogError("Failed to register client - no response received");
                    NotifyConnectionStatusChanged(false);
                    return false;
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error registering client", ex);
                NotifyConnectionStatusChanged(false);
                return false;
            }
        }
        
        public async Task<List<PrintJob>> GetAssignedJobsAsync()
        {
            if (!IsRegistered)
            {
                Logger.LogWarning("Cannot get jobs - client not registered");
                return new List<PrintJob>();
            }
            
            try
            {
                var url = $"/jobs/?client_id={_clientId}";
                var jobs = await GetAsync<List<PrintJob>>(url);
                
                if (jobs != null && jobs.Count > 0)
                {
                    Logger.LogInfo($"Retrieved {jobs.Count} assigned print jobs");
                }
                
                return jobs ?? new List<PrintJob>();
            }
            catch (Exception ex)
            {
                Logger.LogError("Error getting assigned jobs", ex);
                NotifyConnectionStatusChanged(false);
                return new List<PrintJob>();
            }
        }
        
        public async Task<bool> UpdatePrinterStatusAsync(List<Printer> printers)
        {
            if (!IsRegistered)
            {
                Logger.LogWarning("Cannot update printer status - client not registered");
                return false;
            }
            
            try
            {
                var request = new PrinterStatusUpdateRequest
                {
                    ClientId = _clientId!,
                    Printers = printers
                };
                
                var response = await PostAsync<object>("/status/", request);
                return response != null;
            }
            catch (Exception ex)
            {
                Logger.LogError("Error updating printer status", ex);
                NotifyConnectionStatusChanged(false);
                return false;
            }
        }
        
        public async Task<bool> CompleteJobAsync(string jobId, bool success, string? errorMessage = null, string? usedPrinterName = null)
        {
            if (!IsRegistered)
            {
                Logger.LogWarning("Cannot complete job - client not registered");
                return false;
            }
            
            try
            {
                var request = new PrintJobCompletionRequest
                {
                    Status = success ? "completed" : "failed",
                    ErrorMessage = errorMessage,
                    UsedPrinterName = usedPrinterName
                };
                
                var url = $"/job/{jobId}/complete/";
                var response = await PostAsync<object>(url, request);
                
                if (response != null)
                {
                    Logger.LogInfo($"Job {jobId} marked as {request.Status}");
                    return true;
                }
                
                return false;
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error completing job {jobId}", ex);
                return false;
            }
        }
        
        public async Task<HeartbeatResponse?> SendHeartbeatAsync()
        {
            if (!IsRegistered)
            {
                Logger.LogWarning("Cannot send heartbeat - client not registered");
                return null;
            }
            
            try
            {
                var url = $"/heartbeat/?client_id={_clientId}";
                var response = await GetAsync<HeartbeatResponse>(url);
                
                if (response != null)
                {
                    NotifyConnectionStatusChanged(true);
                    Logger.LogDebug($"Heartbeat sent - pending jobs: {response.PendingJobsCount}");
                }
                else
                {
                    NotifyConnectionStatusChanged(false);
                }
                
                return response;
            }
            catch (Exception ex)
            {
                Logger.LogError("Error sending heartbeat", ex);
                NotifyConnectionStatusChanged(false);
                return null;
            }
        }
        
        public async Task<bool> TestConnectionAsync()
        {
            try
            {
                using var response = await _httpClient.GetAsync($"{_baseUrl}/heartbeat/?client_id=test");
                return response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.BadRequest; // BadRequest means API is running
            }
            catch
            {
                return false;
            }
        }
        
        private async Task<T?> GetAsync<T>(string endpoint)
        {
            try
            {
                var url = $"{_baseUrl}{endpoint}";
                Logger.LogDebug($"GET {url}");
                
                using var response = await _httpClient.GetAsync(url);
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    Logger.LogDebug($"Response: {content}");
                    
                    if (string.IsNullOrWhiteSpace(content))
                        return default(T);
                    
                    return JsonConvert.DeserializeObject<T>(content);
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    var friendlyError = GetFriendlyHttpError(response.StatusCode, errorContent);
                    Logger.LogError($"API Error {response.StatusCode}: {friendlyError}");
                    return default(T);
                }
            }
            catch (Exception ex)
            {
                var friendlyError = GetFriendlyConnectionError(ex);
                Logger.LogError($"GET request failed ({endpoint}): {friendlyError}", ex);
                return default(T);
            }
        }
        
        private async Task<T?> PostAsync<T>(string endpoint, object data)
        {
            try
            {
                var url = $"{_baseUrl}{endpoint}";
                var json = JsonConvert.SerializeObject(data, Formatting.None);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                Logger.LogDebug($"POST {url}");
                Logger.LogDebug($"Request: {json}");
                
                using var response = await _httpClient.PostAsync(url, content);
                
                var responseContent = await response.Content.ReadAsStringAsync();
                Logger.LogDebug($"Response: {responseContent}");
                
                if (response.IsSuccessStatusCode)
                {
                    if (string.IsNullOrWhiteSpace(responseContent))
                        return default(T);
                    
                    return JsonConvert.DeserializeObject<T>(responseContent);
                }
                else
                {
                    var friendlyError = GetFriendlyHttpError(response.StatusCode, responseContent);
                    Logger.LogError($"API Error {response.StatusCode}: {friendlyError}");
                    return default(T);
                }
            }
            catch (Exception ex)
            {
                var friendlyError = GetFriendlyConnectionError(ex);
                Logger.LogError($"POST request failed ({endpoint}): {friendlyError}", ex);
                return default(T);
            }
        }
        
        private string GetFriendlyHttpError(System.Net.HttpStatusCode statusCode, string content)
        {
            return statusCode switch
            {
                System.Net.HttpStatusCode.NotFound => "PrintCloud server endpoint not found. Please check your API endpoint configuration.",
                System.Net.HttpStatusCode.Unauthorized => "Authentication failed. Please check your API credentials.",
                System.Net.HttpStatusCode.Forbidden => "Access denied. You don't have permission to access this resource.",
                System.Net.HttpStatusCode.BadRequest => "Invalid request sent to server. This may indicate a configuration issue.",
                System.Net.HttpStatusCode.InternalServerError => "PrintCloud server encountered an internal error. Please try again later.",
                System.Net.HttpStatusCode.BadGateway => "Unable to reach PrintCloud server. Please check if the server is running.",
                System.Net.HttpStatusCode.ServiceUnavailable => "PrintCloud server is temporarily unavailable. Please try again in a few minutes.",
                System.Net.HttpStatusCode.RequestTimeout => "Request to PrintCloud server timed out. Please check your network connection.",
                _ => $"Server returned {statusCode}: {(string.IsNullOrEmpty(content) ? "No additional details" : content)}"
            };
        }
        
        private string GetFriendlyConnectionError(Exception ex)
        {
            var message = ex.Message.ToLowerInvariant();
            
            if (ex is HttpRequestException)
            {
                if (message.Contains("connection refused") || message.Contains("no connection could be made"))
                {
                    return "Cannot connect to PrintCloud server. Please ensure the server is running and check your network connection.";
                }
                else if (message.Contains("timeout"))
                {
                    return "Connection to PrintCloud server timed out. Please check your network connection and server status.";
                }
                else if (message.Contains("name resolution") || message.Contains("dns"))
                {
                    return "Cannot resolve server address. Please check your API endpoint URL in settings.";
                }
                else if (message.Contains("ssl") || message.Contains("certificate"))
                {
                    return "SSL/Certificate error. Please verify the server URL and certificate validity.";
                }
            }
            else if (ex is TaskCanceledException)
            {
                return "Request was cancelled or timed out. Please try again.";
            }
            
            return $"Network error: {ex.Message}";
        }
        
        private string GetLocalIpAddress()
        {
            try
            {
                foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (networkInterface.OperationalStatus != OperationalStatus.Up ||
                        networkInterface.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                        continue;
                    
                    foreach (var unicastAddress in networkInterface.GetIPProperties().UnicastAddresses)
                    {
                        if (unicastAddress.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                        {
                            var ip = unicastAddress.Address.ToString();
                            // Prefer non-APIPA addresses (169.254.x.x)
                            if (!ip.StartsWith("169.254."))
                                return ip;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error getting local IP address", ex);
            }
            
            return "127.0.0.1"; // Fallback
        }
        
        private void NotifyConnectionStatusChanged(bool isConnected)
        {
            try
            {
                if (isConnected && _isRetrying)
                {
                    // Connection restored - stop retrying
                    _isRetrying = false;
                    _retryAttempt = 0;
                    _retryTimer?.Stop();
                    Logger.LogInfo("Connection restored - stopping retry attempts");
                    NotifyRetryStatusChanged();
                }
                else if (!isConnected && !_isRetrying)
                {
                    // Connection lost - start retry process
                    StartRetryProcess();
                }
                
                ConnectionStatusChanged?.Invoke(this, new ConnectionStatusChangedEventArgs { IsConnected = isConnected });
            }
            catch (Exception ex)
            {
                Logger.LogError("Error notifying connection status change", ex);
            }
        }
        
        private void StartRetryProcess()
        {
            if (_isRetrying) return; // Already retrying
            
            _isRetrying = true;
            _retryAttempt = 0;
            _lastRetryTime = DateTime.Now;
            
            Logger.LogWarning("Connection lost - starting exponential backoff retry process");
            
            ScheduleNextRetry();
            NotifyRetryStatusChanged();
        }
        
        private void ScheduleNextRetry()
        {
            if (!_isRetrying) return;
            
            var delaySeconds = _retryIntervals[Math.Min(_retryAttempt, _retryIntervals.Length - 1)];
            _lastRetryTime = DateTime.Now;
            
            Logger.LogInfo($"Scheduling retry attempt #{_retryAttempt + 1} in {delaySeconds} seconds");
            
            _retryTimer?.Stop();
            _retryTimer = new System.Timers.Timer(delaySeconds * 1000);
            _retryTimer.Elapsed += async (sender, e) => await AttemptReconnection();
            _retryTimer.AutoReset = false;
            _retryTimer.Start();
            
            NotifyRetryStatusChanged();
        }
        
        private async Task AttemptReconnection()
        {
            try
            {
                _retryAttempt++;
                Logger.LogInfo($"Attempting reconnection #{_retryAttempt}");
                
                // Test basic connectivity first
                var isConnected = await TestConnectionAsync();
                
                if (isConnected)
                {
                    Logger.LogInfo("Connection test successful - attempting re-registration");
                    
                    // If we have registration data, try to re-register
                    // For now, just mark as connected and let the main app handle re-registration
                    NotifyConnectionStatusChanged(true);
                }
                else
                {
                    Logger.LogWarning($"Reconnection attempt #{_retryAttempt} failed");
                    
                    // Check if we've exceeded maximum retry attempts
                    if (_retryAttempt >= _retryIntervals.Length * 10) // Allow up to 50 total attempts
                    {
                        Logger.LogError("Maximum retry attempts reached - giving up automatic retries");
                        _isRetrying = false;
                        NotifyRetryStatusChanged();
                        return;
                    }
                    
                    // Schedule next retry with exponential backoff
                    ScheduleNextRetry();
                }
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error during reconnection attempt #{_retryAttempt}", ex);
                ScheduleNextRetry();
            }
        }
        
        public async Task<bool> ManualReconnectAsync()
        {
            Logger.LogInfo("Manual reconnection attempt initiated");
            
            try
            {
                var isConnected = await TestConnectionAsync();
                
                if (isConnected)
                {
                    NotifyConnectionStatusChanged(true);
                    return true;
                }
                else
                {
                    Logger.LogWarning("Manual reconnection failed");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error during manual reconnection", ex);
                return false;
            }
        }
        
        public void StopRetryProcess()
        {
            if (!_isRetrying) return;
            
            Logger.LogInfo("Stopping retry process");
            _isRetrying = false;
            _retryAttempt = 0;
            _retryTimer?.Stop();
            NotifyRetryStatusChanged();
        }
        
        private void NotifyRetryStatusChanged()
        {
            try
            {
                var args = new RetryStatusChangedEventArgs
                {
                    IsRetrying = _isRetrying,
                    RetryAttempt = _retryAttempt,
                    SecondsUntilNextRetry = SecondsUntilNextRetry
                };
                
                RetryStatusChanged?.Invoke(this, args);
            }
            catch (Exception ex)
            {
                Logger.LogError("Error notifying retry status change", ex);
            }
        }
        
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }
        
        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing)
                {
                    StopRetryProcess();
                    _retryTimer?.Dispose();
                    _httpClient?.Dispose();
                }
                
                _disposed = true;
            }
        }
    }
    
    public class ConnectionStatusChangedEventArgs : EventArgs
    {
        public bool IsConnected { get; set; }
    }
    
    public class RetryStatusChangedEventArgs : EventArgs
    {
        public bool IsRetrying { get; set; }
        public int RetryAttempt { get; set; }
        public int SecondsUntilNextRetry { get; set; }
    }
}
