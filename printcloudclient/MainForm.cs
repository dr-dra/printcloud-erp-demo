using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Timers;
using System.Windows.Forms;
using PrintCloudClient.Models;

namespace PrintCloudClient
{
    public partial class MainForm : Form
    {
        private readonly ConfigManager _configManager;
        private readonly PrinterManager _printerManager;
        private ApiClient _apiClient;
        private PrintJobProcessor _jobProcessor;
        private readonly TrayManager _trayManager;
        
        private readonly System.Timers.Timer _heartbeatTimer = new System.Timers.Timer();
        private readonly System.Timers.Timer _jobPollingTimer = new System.Timers.Timer();
        private readonly System.Timers.Timer _printerDiscoveryTimer = new System.Timers.Timer();
        private readonly System.Timers.Timer _apiEndpointDebounceTimer = new System.Timers.Timer();
        
        private bool _isConnected = false;
        private bool _isClosing = false;
        private bool _wasDisconnected = false;

        private readonly SemaphoreSlim _jobPollSemaphore = new SemaphoreSlim(1, 1);
        private readonly HashSet<string> _processingJobs = new HashSet<string>();
        private readonly object _processingJobsLock = new object();

        private readonly object _apiEndpointLock = new object();
        private string _pendingApiEndpoint = string.Empty;
        private string _appliedApiEndpoint = string.Empty;
        
        // UI Controls
        private Label lblConnectionStatus = null!;
        private Label lblRetryStatus = null!;
        private Label lblVersion = null!;
        private Label lblClientId = null!;
        private Button btnManualReconnect = null!;
        private ListView listViewPrinters = null!;
        private ListView listViewRecentJobs = null!;
        private Button btnSettings = null!;
        private Button btnRefreshPrinters = null!;
        private Button btnViewLogs = null!;
        private TextBox txtApiEndpoint = null!;
        private CheckBox chkAutoStart = null!;
        
        // Status update timer
        private System.Timers.Timer _statusUpdateTimer = new System.Timers.Timer(1000); // Update every second
        
        public MainForm()
        {
            _configManager = new ConfigManager();
            _printerManager = new PrinterManager();
            _apiClient = new ApiClient(_configManager.Settings.ApiEndpointUrl);
            _jobProcessor = new PrintJobProcessor(_printerManager, _apiClient);
            _trayManager = new TrayManager(this);

            _appliedApiEndpoint = _configManager.Settings.ApiEndpointUrl;
            
            InitializeComponent();
            InitializeTimers();
            InitializeApiEndpointDebounce();
            SetupEventHandlers();
            
            Logger.LogInfo("PrintCloudClient started");
            
            // Start background operations
            _ = Task.Run(InitializeAsync);
        }
        
        private void InitializeComponent()
        {
            Text = "PrintCloud Client";
            Size = new Size(800, 600);
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(600, 400);
            
            // Create main layout
            var mainPanel = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 4
            };
            
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            mainPanel.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            mainPanel.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            
            // Status panel
            var statusPanel = CreateStatusPanel();
            mainPanel.Controls.Add(statusPanel, 0, 0);
            
            // Printers panel
            var printersPanel = CreatePrintersPanel();
            mainPanel.Controls.Add(printersPanel, 0, 1);
            
            // Recent jobs panel
            var jobsPanel = CreateRecentJobsPanel();
            mainPanel.Controls.Add(jobsPanel, 0, 2);
            
            // Settings panel
            var settingsPanel = CreateSettingsPanel();
            mainPanel.Controls.Add(settingsPanel, 0, 3);
            
            Controls.Add(mainPanel);
        }
        
        private Panel CreateStatusPanel()
        {
            var panel = new Panel { Height = 140, Dock = DockStyle.Fill };
            
            var groupBox = new GroupBox
            {
                Text = "Connection Status",
                Dock = DockStyle.Fill,
                Padding = new Padding(10)
            };
            
            lblConnectionStatus = new Label
            {
                Text = "Disconnected",
                ForeColor = Color.Red,
                Font = new Font(Font, FontStyle.Bold),
                Location = new Point(10, 25),
                AutoSize = true
            };
            
            lblRetryStatus = new Label
            {
                Text = "",
                ForeColor = Color.Orange,
                Location = new Point(10, 50),
                AutoSize = true,
                Visible = false
            };
            
            lblVersion = new Label
            {
                Text = $"Version: {AppInfo.Version}",
                Location = new Point(10, 75),
                AutoSize = true
            };
            
            lblClientId = new Label
            {
                Text = "Client ID: Not registered",
                Location = new Point(10, 95),
                AutoSize = true
            };
            
            btnManualReconnect = new Button
            {
                Text = "Reconnect Now",
                Size = new Size(100, 25),
                Location = new Point(300, 25),
                Enabled = false
            };
            btnManualReconnect.Click += BtnManualReconnect_Click;
            
            groupBox.Controls.AddRange(new Control[] { 
                lblConnectionStatus, 
                lblRetryStatus, 
                lblVersion, 
                lblClientId, 
                btnManualReconnect 
            });
            panel.Controls.Add(groupBox);
            
            return panel;
        }
        
        private Panel CreatePrintersPanel()
        {
            var panel = new Panel { Dock = DockStyle.Fill };
            
            var groupBox = new GroupBox
            {
                Text = "Discovered Printers",
                Dock = DockStyle.Fill,
                Padding = new Padding(5)
            };
            
            listViewPrinters = new ListView
            {
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                Dock = DockStyle.Fill,
                Margin = new Padding(0, 0, 0, 35)
            };
            
            listViewPrinters.Columns.Add("Name", 200);
            listViewPrinters.Columns.Add("Type", 100);
            listViewPrinters.Columns.Add("Status", 100);
            listViewPrinters.Columns.Add("Driver", 250);
            listViewPrinters.Columns.Add("Port", 150);
            
            btnRefreshPrinters = new Button
            {
                Text = "Refresh Printers",
                Size = new Size(120, 30),
                Dock = DockStyle.Bottom
            };
            btnRefreshPrinters.Click += BtnRefreshPrinters_Click;
            
            groupBox.Controls.Add(listViewPrinters);
            groupBox.Controls.Add(btnRefreshPrinters);
            panel.Controls.Add(groupBox);
            
            return panel;
        }
        
        private Panel CreateRecentJobsPanel()
        {
            var panel = new Panel { Dock = DockStyle.Fill };
            
            var groupBox = new GroupBox
            {
                Text = "Recent Print Jobs",
                Dock = DockStyle.Fill,
                Padding = new Padding(5)
            };
            
            listViewRecentJobs = new ListView
            {
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                Dock = DockStyle.Fill
            };
            
            listViewRecentJobs.Columns.Add("Job ID", 100);
            listViewRecentJobs.Columns.Add("Document Type", 120);
            listViewRecentJobs.Columns.Add("Printer", 200);
            listViewRecentJobs.Columns.Add("Status", 100);
            listViewRecentJobs.Columns.Add("Time", 140);
            
            groupBox.Controls.Add(listViewRecentJobs);
            panel.Controls.Add(groupBox);
            
            return panel;
        }
        
        private Panel CreateSettingsPanel()
        {
            var panel = new Panel { Height = 100, Dock = DockStyle.Fill };
            
            var groupBox = new GroupBox
            {
                Text = "Settings",
                Dock = DockStyle.Fill,
                Padding = new Padding(10)
            };
            
            var lblApiEndpoint = new Label
            {
                Text = "API Endpoint:",
                Location = new Point(10, 25),
                AutoSize = true
            };
            
            txtApiEndpoint = new TextBox
            {
                Location = new Point(100, 22),
                Size = new Size(300, 23),
                Text = _configManager.Settings.ApiEndpointUrl
            };
            txtApiEndpoint.TextChanged += TxtApiEndpoint_TextChanged;
            txtApiEndpoint.Leave += TxtApiEndpoint_Leave;
            txtApiEndpoint.KeyDown += TxtApiEndpoint_KeyDown;
            
            chkAutoStart = new CheckBox
            {
                Text = "Start with Windows",
                Location = new Point(10, 55),
                Checked = _configManager.Settings.AutoStartWithWindows,
                AutoSize = true
            };
            chkAutoStart.CheckedChanged += ChkAutoStart_CheckedChanged;
            
            btnSettings = new Button
            {
                Text = "Advanced Settings",
                Location = new Point(420, 20),
                Size = new Size(120, 30)
            };
            btnSettings.Click += BtnSettings_Click;
            
            btnViewLogs = new Button
            {
                Text = "View Logs",
                Location = new Point(550, 20),
                Size = new Size(80, 30)
            };
            btnViewLogs.Click += BtnViewLogs_Click;
            
            groupBox.Controls.AddRange(new Control[] { 
                lblApiEndpoint, txtApiEndpoint, chkAutoStart, btnSettings, btnViewLogs 
            });
            panel.Controls.Add(groupBox);
            
            return panel;
        }
        
        private void InitializeTimers()
        {
            _heartbeatTimer.Interval = _configManager.Settings.HeartbeatIntervalSeconds * 1000;
            _heartbeatTimer.Elapsed += HeartbeatTimer_Elapsed;
            
            _jobPollingTimer.Interval = _configManager.Settings.JobPollingIntervalSeconds * 1000;
            _jobPollingTimer.Elapsed += JobPollingTimer_Elapsed;
            
            _printerDiscoveryTimer.Interval = _configManager.Settings.PrinterDiscoveryIntervalSeconds * 1000;
            _printerDiscoveryTimer.Elapsed += PrinterDiscoveryTimer_Elapsed;
        }

        private void InitializeApiEndpointDebounce()
        {
            _apiEndpointDebounceTimer.Interval = 600;
            _apiEndpointDebounceTimer.AutoReset = false;
            _apiEndpointDebounceTimer.Elapsed += ApiEndpointDebounceTimer_Elapsed;
        }

        private void ApiEndpointDebounceTimer_Elapsed(object? sender, ElapsedEventArgs e)
        {
            string pendingEndpoint;
            lock (_apiEndpointLock)
            {
                pendingEndpoint = _pendingApiEndpoint;
            }

            ApplyApiEndpointChange(pendingEndpoint);
        }

        private void ApplyApiEndpointChange(string endpoint)
        {
            var normalizedEndpoint = endpoint.Trim();
            if (string.IsNullOrEmpty(normalizedEndpoint) || normalizedEndpoint == _appliedApiEndpoint)
            {
                return;
            }

            if (!IsValidApiEndpoint(normalizedEndpoint))
            {
                Logger.LogWarning($"Invalid API endpoint entered: {normalizedEndpoint}");
                return;
            }

            _appliedApiEndpoint = normalizedEndpoint;
            _configManager.UpdateApiEndpoint(normalizedEndpoint);
            _ = Task.Run(async () => await ReinitializeApiClientAsync(normalizedEndpoint));
        }

        private static bool IsValidApiEndpoint(string endpoint)
        {
            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
            {
                return false;
            }

            return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
        }

        private async Task ReinitializeApiClientAsync(string apiEndpoint)
        {
            try
            {
                StopTimers();

                _apiClient.ConnectionStatusChanged -= ApiClient_ConnectionStatusChanged;
                _apiClient.RetryStatusChanged -= ApiClient_RetryStatusChanged;
                _apiClient.Dispose();

                _apiClient = new ApiClient(apiEndpoint);
                _apiClient.ConnectionStatusChanged += ApiClient_ConnectionStatusChanged;
                _apiClient.RetryStatusChanged += ApiClient_RetryStatusChanged;

                _jobProcessor.JobProcessed -= JobProcessor_JobProcessed;
                _jobProcessor = new PrintJobProcessor(_printerManager, _apiClient);
                _jobProcessor.JobProcessed += JobProcessor_JobProcessed;

                await InitializeAsync();
            }
            catch (Exception ex)
            {
                Logger.LogError("Error reinitializing API client", ex);
                UpdateConnectionStatus(false);
            }
        }
        
        private void SetupEventHandlers()
        {
            _printerManager.PrintersChanged += PrinterManager_PrintersChanged;
            _apiClient.ConnectionStatusChanged += ApiClient_ConnectionStatusChanged;
            _apiClient.RetryStatusChanged += ApiClient_RetryStatusChanged;
            _jobProcessor.JobProcessed += JobProcessor_JobProcessed;
            
            // Setup status update timer
            _statusUpdateTimer.Elapsed += StatusUpdateTimer_Elapsed;
            _statusUpdateTimer.Start();
            
            FormClosing += MainForm_FormClosing;
            Resize += MainForm_Resize;
            
            Load += MainForm_Load;
        }
        
        private async Task InitializeAsync()
        {
            try
            {
                // Discover printers first
                await _printerManager.DiscoverPrintersAsync();
                UpdatePrintersDisplay();

                await RegisterWithApiAsync();
            }
            catch (Exception ex)
            {
                Logger.LogError("Error during initialization", ex);
                UpdateConnectionStatus(false);
            }
        }

        private async Task RegisterWithApiAsync()
        {
            try
            {
                var computerName = Environment.MachineName;
                var printers = _printerManager.GetDiscoveredPrinters();

                var registered = await _apiClient.RegisterClientAsync(computerName, printers, AppInfo.Version);
                if (registered)
                {
                    StartTimers();
                    UpdateConnectionStatus(true);
                }
                else
                {
                    StopTimers();
                    UpdateConnectionStatus(false);
                    Logger.LogError("Failed to register with API");
                }
            }
            catch (Exception ex)
            {
                StopTimers();
                Logger.LogError("Error registering with API", ex);
                UpdateConnectionStatus(false);
            }
        }

        private async Task HandleReconnectedAsync()
        {
            try
            {
                await RegisterWithApiAsync();
            }
            catch (Exception ex)
            {
                Logger.LogError("Error during reconnection registration", ex);
            }
        }
        
        private void StartTimers()
        {
            _heartbeatTimer.Start();
            _jobPollingTimer.Start();
            _printerDiscoveryTimer.Start();
        }
        
        private void StopTimers()
        {
            _heartbeatTimer?.Stop();
            _jobPollingTimer?.Stop();
            _printerDiscoveryTimer?.Stop();
            _statusUpdateTimer?.Stop();
            _apiEndpointDebounceTimer?.Stop();
        }
        
        private async void HeartbeatTimer_Elapsed(object? sender, ElapsedEventArgs e)
        {
            if (_isClosing) return;
            
            try
            {
                var response = await _apiClient.SendHeartbeatAsync();
                if (response != null)
                {
                    // Update any status information from heartbeat
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error in heartbeat timer", ex);
            }
        }
        
        private async void JobPollingTimer_Elapsed(object? sender, ElapsedEventArgs e)
        {
            if (_isClosing) return;

            var acquired = false;
            try
            {
                acquired = await _jobPollSemaphore.WaitAsync(0);
                if (!acquired)
                {
                    return;
                }

                var jobs = await _apiClient.GetAssignedJobsAsync();

                foreach (var job in jobs)
                {
                    lock (_processingJobsLock)
                    {
                        if (_processingJobs.Contains(job.Id))
                        {
                            continue;
                        }

                        _processingJobs.Add(job.Id);
                    }

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _jobProcessor.ProcessJobAsync(job);
                        }
                        catch (Exception ex)
                        {
                            Logger.LogError($"Error processing job {job.Id}", ex);
                        }
                        finally
                        {
                            lock (_processingJobsLock)
                            {
                                _processingJobs.Remove(job.Id);
                            }
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error in job polling timer", ex);
            }
            finally
            {
                if (acquired)
                {
                    _jobPollSemaphore.Release();
                }
            }
        }
        
        private async void PrinterDiscoveryTimer_Elapsed(object? sender, ElapsedEventArgs e)
        {
            if (_isClosing) return;
            
            try
            {
                await _printerManager.DiscoverPrintersAsync();
                
                // Update printer status with API
                var printers = _printerManager.GetDiscoveredPrinters();
                await _apiClient.UpdatePrinterStatusAsync(printers);
            }
            catch (Exception ex)
            {
                Logger.LogError("Error in printer discovery timer", ex);
            }
        }
        
        // Event handlers continue in next part due to length...
        
        private void UpdateConnectionStatus(bool connected)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<bool>(UpdateConnectionStatus), connected);
                return;
            }

            _isConnected = connected;

            if (!connected)
            {
                _wasDisconnected = true;
                StopTimers();
            }
            else if (_wasDisconnected)
            {
                _wasDisconnected = false;
                _ = Task.Run(HandleReconnectedAsync);
            }
            
            lblConnectionStatus.Text = connected ? "Connected" : "Disconnected";
            lblConnectionStatus.ForeColor = connected ? Color.Green : Color.Red;
            lblClientId.Text = $"Client ID: {(_apiClient.ClientId ?? "Not registered")}";

            // Update manual reconnect button state
            btnManualReconnect.Enabled = !connected;

            // Hide retry status when connected
            if (connected)
            {
                lblRetryStatus.Visible = false;
            }

            _trayManager.UpdateTrayIconStatus(connected);
            _trayManager.UpdateStatusText(connected ? "Status: Connected" : "Status: Disconnected");
        }
        
        private void UpdateRetryStatus(bool isRetrying, int retryAttempt, int secondsUntilNext)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<bool, int, int>(UpdateRetryStatus), isRetrying, retryAttempt, secondsUntilNext);
                return;
            }
            
            if (isRetrying)
            {
                lblRetryStatus.Text = $"Reconnecting... Attempt {retryAttempt}, next retry in {secondsUntilNext}s";
                lblRetryStatus.Visible = true;
                btnManualReconnect.Enabled = true;
                _trayManager.UpdateStatusText($"Status: Reconnecting (attempt {retryAttempt})");
            }
            else
            {
                lblRetryStatus.Visible = false;
                _trayManager.UpdateStatusText(_isConnected ? "Status: Connected" : "Status: Disconnected");
            }
        }
        
        private void UpdateRetryCountdown()
        {
            if (_apiClient.IsRetrying && lblRetryStatus.Visible)
            {
                var secondsUntilNext = _apiClient.SecondsUntilNextRetry;
                if (secondsUntilNext >= 0)
                {
                    lblRetryStatus.Text = $"Reconnecting... Attempt {_apiClient.RetryAttempt}, next retry in {secondsUntilNext}s";
                }
            }
        }
        
        private void UpdatePrintersDisplay()
        {
            if (InvokeRequired)
            {
                Invoke(new Action(UpdatePrintersDisplay));
                return;
            }
            
            listViewPrinters.Items.Clear();
            
            var printers = _printerManager.GetDiscoveredPrinters();
            foreach (var printer in printers.OrderBy(p => p.PrinterType).ThenBy(p => p.Name))
            {
                var item = new ListViewItem(printer.Name);
                item.SubItems.Add(printer.PrinterType == "pos" ? "POS/Thermal" : "Standard");
                item.SubItems.Add(printer.Status);
                item.SubItems.Add(printer.Driver ?? "");
                
                var port = "";
                if (printer.Capabilities.TryGetValue("port_name", out var portObj))
                {
                    port = portObj?.ToString() ?? "";
                }
                item.SubItems.Add(port);
                
                item.Tag = printer;
                listViewPrinters.Items.Add(item);
            }
        }
        
        private void PrinterManager_PrintersChanged(object? sender, PrintersChangedEventArgs e)
        {
            UpdatePrintersDisplay();
            Logger.LogInfo($"Printers changed: {e.Printers.Count} total, {e.AddedPrinters.Count} added, {e.RemovedPrinters.Count} removed");
        }
        
        private void ApiClient_ConnectionStatusChanged(object? sender, ConnectionStatusChangedEventArgs e)
        {
            UpdateConnectionStatus(e.IsConnected);
        }
        
        private void JobProcessor_JobProcessed(object? sender, JobProcessedEventArgs e)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<object?, JobProcessedEventArgs>(JobProcessor_JobProcessed), sender, e);
                return;
            }
            
            // Add to recent jobs list
            var item = new ListViewItem(e.Job.Id[..8] + "...");
            item.SubItems.Add(e.Job.DocumentType);
            item.SubItems.Add(e.UsedPrinterName ?? "Unknown");
            item.SubItems.Add(e.Success ? "Completed" : "Failed");
            item.SubItems.Add(DateTime.Now.ToString("HH:mm:ss"));
            
            listViewRecentJobs.Items.Insert(0, item);
            
            // Keep only last 50 jobs
            while (listViewRecentJobs.Items.Count > 50)
            {
                listViewRecentJobs.Items.RemoveAt(listViewRecentJobs.Items.Count - 1);
            }
        }
        
        private void ApiClient_RetryStatusChanged(object? sender, RetryStatusChangedEventArgs e)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<object?, RetryStatusChangedEventArgs>(ApiClient_RetryStatusChanged), sender, e);
                return;
            }
            
            UpdateRetryStatus(e.IsRetrying, e.RetryAttempt, e.SecondsUntilNextRetry);
        }
        
        private void StatusUpdateTimer_Elapsed(object? sender, System.Timers.ElapsedEventArgs e)
        {
            if (InvokeRequired)
            {
                Invoke(new Action(() => UpdateRetryCountdown()));
                return;
            }
            
            UpdateRetryCountdown();
        }
        
        private async void BtnManualReconnect_Click(object? sender, EventArgs e)
        {
            btnManualReconnect.Enabled = false;
            btnManualReconnect.Text = "Connecting...";
            
            try
            {
                var success = await _apiClient.ManualReconnectAsync();
                if (!success)
                {
                    MessageBox.Show("Manual reconnection failed. Please check your network connection and API endpoint settings.", 
                        "Connection Failed", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            finally
            {
                btnManualReconnect.Enabled = true;
                btnManualReconnect.Text = "Reconnect Now";
            }
        }
        
        private async void BtnRefreshPrinters_Click(object? sender, EventArgs e)
        {
            btnRefreshPrinters.Enabled = false;
            btnRefreshPrinters.Text = "Refreshing...";
            
            try
            {
                await _printerManager.DiscoverPrintersAsync();
            }
            finally
            {
                btnRefreshPrinters.Enabled = true;
                btnRefreshPrinters.Text = "Refresh Printers";
            }
        }
        
        private void TxtApiEndpoint_TextChanged(object? sender, EventArgs e)
        {
            lock (_apiEndpointLock)
            {
                _pendingApiEndpoint = txtApiEndpoint.Text;
            }

            _apiEndpointDebounceTimer.Stop();
            _apiEndpointDebounceTimer.Start();
        }

        private void TxtApiEndpoint_Leave(object? sender, EventArgs e)
        {
            ApplyApiEndpointChange(txtApiEndpoint.Text);
        }

        private void TxtApiEndpoint_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter)
            {
                ApplyApiEndpointChange(txtApiEndpoint.Text);
                e.SuppressKeyPress = true;
            }
        }
        
        private void ChkAutoStart_CheckedChanged(object? sender, EventArgs e)
        {
            _configManager.SetAutoStartWithWindows(chkAutoStart.Checked);
        }
        
        private void BtnSettings_Click(object? sender, EventArgs e)
        {
            // TODO: Implement advanced settings dialog
            MessageBox.Show("Advanced settings dialog not implemented yet.", "Info", 
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        
        private void BtnViewLogs_Click(object? sender, EventArgs e)
        {
            try
            {
                var logDir = Logger.GetLogDirectory();
                System.Diagnostics.Process.Start("explorer.exe", logDir);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Cannot open logs directory: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        
        private void MainForm_Load(object? sender, EventArgs e)
        {
            // Check if started with --minimized argument
            var args = Environment.GetCommandLineArgs();
            if (args.Length > 1 && args[1] == "--minimized")
            {
                WindowState = FormWindowState.Minimized;
                ShowInTaskbar = false;
            }
        }
        
        private void MainForm_Resize(object? sender, EventArgs e)
        {
            if (WindowState == FormWindowState.Minimized)
            {
                Hide();
                ShowInTaskbar = false;
                _trayManager.ShowBalloonTip("PrintCloudClient", "Application minimized to system tray");
            }
        }
        
        private void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                WindowState = FormWindowState.Minimized;
                return;
            }
            
            _isClosing = true;
            StopTimers();
            
            _trayManager?.Dispose();
            _apiClient?.Dispose();
            
            Logger.LogInfo("PrintCloudClient shutting down");
        }
        
        public void ShowMainWindow()
        {
            Show();
            WindowState = FormWindowState.Normal;
            ShowInTaskbar = true;
            BringToFront();
            Activate();
        }
        
        public void ExitApplication()
        {
            _isClosing = true;
            Application.Exit();
        }
    }
}
