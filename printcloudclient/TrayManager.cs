using System;
using System.Drawing;
using System.Windows.Forms;

namespace PrintCloudClient
{
    public class TrayManager : IDisposable
    {
        private readonly MainForm _mainForm;
        private readonly NotifyIcon _notifyIcon;
        private readonly ContextMenuStrip _contextMenu;
        private ToolStripMenuItem? _statusMenuItem;
        private string _statusText = "Status: Checking...";
        private bool _disposed = false;
        
        public TrayManager(MainForm mainForm)
        {
            _mainForm = mainForm;
            
            // Create context menu
            _contextMenu = CreateContextMenu();
            
            // Create notify icon
            _notifyIcon = new NotifyIcon
            {
                Text = "PrintCloudClient",
                Icon = CreateTrayIcon(),
                ContextMenuStrip = _contextMenu,
                Visible = true
            };
            
            // Set up event handlers
            _notifyIcon.DoubleClick += NotifyIcon_DoubleClick;
            _notifyIcon.MouseClick += NotifyIcon_MouseClick;
            
            Logger.LogInfo("System tray icon initialized");
        }
        
        private ContextMenuStrip CreateContextMenu()
        {
            var contextMenu = new ContextMenuStrip();
            
            // Show/Hide main window
            var showHideItem = new ToolStripMenuItem("Show PrintCloudClient");
            showHideItem.Click += ShowHideItem_Click;
            showHideItem.Font = new Font(showHideItem.Font, FontStyle.Bold);
            contextMenu.Items.Add(showHideItem);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // Connection status (read-only)
            _statusMenuItem = new ToolStripMenuItem(_statusText);
            _statusMenuItem.Enabled = false;
            contextMenu.Items.Add(_statusMenuItem);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // Quick actions
            var refreshPrintersItem = new ToolStripMenuItem("Refresh Printers");
            refreshPrintersItem.Click += RefreshPrintersItem_Click;
            contextMenu.Items.Add(refreshPrintersItem);
            
            var viewLogsItem = new ToolStripMenuItem("View Logs");
            viewLogsItem.Click += ViewLogsItem_Click;
            contextMenu.Items.Add(viewLogsItem);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // Settings
            var settingsItem = new ToolStripMenuItem("Settings");
            settingsItem.Click += SettingsItem_Click;
            contextMenu.Items.Add(settingsItem);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            // About
            var aboutItem = new ToolStripMenuItem("About");
            aboutItem.Click += AboutItem_Click;
            contextMenu.Items.Add(aboutItem);
            
            // Exit
            var exitItem = new ToolStripMenuItem("Exit");
            exitItem.Click += ExitItem_Click;
            contextMenu.Items.Add(exitItem);
            
            // Update context menu when it opens
            contextMenu.Opening += ContextMenu_Opening;
            
            return contextMenu;
        }
        
        private Icon CreateTrayIcon()
        {
            try
            {
                // Try to load icon from resources or create a simple one
                // For now, create a simple icon programmatically
                var bitmap = new Bitmap(16, 16);
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    // Draw a simple printer icon
                    graphics.Clear(Color.Transparent);
                    graphics.FillRectangle(Brushes.DarkBlue, 2, 4, 12, 8);
                    graphics.FillRectangle(Brushes.LightBlue, 3, 5, 10, 6);
                    graphics.FillRectangle(Brushes.DarkBlue, 5, 12, 6, 2);
                    graphics.FillRectangle(Brushes.Gray, 1, 14, 14, 1);
                }
                
                var iconHandle = bitmap.GetHicon();
                return Icon.FromHandle(iconHandle);
            }
            catch (Exception ex)
            {
                Logger.LogError("Error creating tray icon", ex);
                // Fallback to system icon
                return SystemIcons.Application;
            }
        }
        
        private void ContextMenu_Opening(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            if (_contextMenu.Items.Count > 0)
            {
                // Update the main show/hide item text
                var showHideItem = _contextMenu.Items[0];
                showHideItem.Text = _mainForm.Visible ? "Hide PrintCloudClient" : "Show PrintCloudClient";
                
                // Update status item if it exists
                if (_statusMenuItem != null)
                {
                    _statusMenuItem.Text = _statusText;
                }
            }
        }
        
        private void NotifyIcon_DoubleClick(object? sender, EventArgs e)
        {
            ShowMainWindow();
        }
        
        private void NotifyIcon_MouseClick(object? sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                // Single left click could also show the window
                // ShowMainWindow();
            }
        }
        
        private void ShowHideItem_Click(object? sender, EventArgs e)
        {
            if (_mainForm.Visible)
            {
                HideMainWindow();
            }
            else
            {
                ShowMainWindow();
            }
        }
        
        private void RefreshPrintersItem_Click(object? sender, EventArgs e)
        {
            try
            {
                // Trigger printer refresh
                Logger.LogInfo("Printer refresh requested from tray menu");
                // You would call the printer manager refresh method here
            }
            catch (Exception ex)
            {
                Logger.LogError("Error refreshing printers from tray", ex);
                ShowBalloonTip("Error", "Failed to refresh printers", ToolTipIcon.Error);
            }
        }
        
        private void ViewLogsItem_Click(object? sender, EventArgs e)
        {
            try
            {
                var logDir = Logger.GetLogDirectory();
                if (!string.IsNullOrEmpty(logDir))
                {
                    System.Diagnostics.Process.Start("explorer.exe", logDir);
                }
                else
                {
                    ShowBalloonTip("Error", "Log directory not found", ToolTipIcon.Error);
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error opening logs from tray", ex);
                ShowBalloonTip("Error", "Cannot open logs directory", ToolTipIcon.Error);
            }
        }
        
        private void SettingsItem_Click(object? sender, EventArgs e)
        {
            ShowMainWindow();
            // Focus on settings section or open settings dialog
        }
        
        private void AboutItem_Click(object? sender, EventArgs e)
        {
            var message = $"PrintCloudClient v{AppInfo.Version}\n\n" +
                         "Connects your local printers to PrintCloud web application.\n\n" +
                         "© 2025 PrintCloud";
            
            MessageBox.Show(message, "About PrintCloudClient", 
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        
        private void ExitItem_Click(object? sender, EventArgs e)
        {
            var result = MessageBox.Show(
                "Are you sure you want to exit PrintCloudClient?\n\nThis will stop print job processing.",
                "Confirm Exit",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2);
            
            if (result == DialogResult.Yes)
            {
                Logger.LogInfo("Application exit requested from tray menu");
                _mainForm.ExitApplication();
            }
        }
        
        public void ShowMainWindow()
        {
            try
            {
                _mainForm.ShowMainWindow();
                Logger.LogDebug("Main window shown from tray");
            }
            catch (Exception ex)
            {
                Logger.LogError("Error showing main window from tray", ex);
            }
        }
        
        public void HideMainWindow()
        {
            try
            {
                _mainForm.Hide();
                _mainForm.ShowInTaskbar = false;
                Logger.LogDebug("Main window hidden to tray");
            }
            catch (Exception ex)
            {
                Logger.LogError("Error hiding main window to tray", ex);
            }
        }
        
        public void ShowBalloonTip(string title, string text, ToolTipIcon icon = ToolTipIcon.Info, int timeout = 3000)
        {
            try
            {
                if (_notifyIcon != null && !_disposed)
                {
                    _notifyIcon.ShowBalloonTip(timeout, title, text, icon);
                    Logger.LogDebug($"Balloon tip shown: {title} - {text}");
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error showing balloon tip", ex);
            }
        }
        
        public void UpdateTrayIconStatus(bool connected, string? statusText = null)
        {
            try
            {
                if (_notifyIcon != null && !_disposed)
                {
                    var status = connected ? "Connected" : "Disconnected";
                    _notifyIcon.Text = $"PrintCloudClient - {status}";
                    
                    if (!string.IsNullOrEmpty(statusText))
                    {
                        _notifyIcon.Text = $"PrintCloudClient - {statusText}";
                    }

                    UpdateStatusText($"Status: {statusText ?? status}");
                    
                    // You could also change the icon color/appearance based on status
                    // _notifyIcon.Icon = connected ? _connectedIcon : _disconnectedIcon;
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Error updating tray icon status", ex);
            }
        }
        
        public void ShowJobCompletedNotification(string jobId, bool success, string printerName)
        {
            var title = success ? "Print Job Completed" : "Print Job Failed";
            var message = success 
                ? $"Job {jobId[..8]}... printed successfully on {printerName}"
                : $"Job {jobId[..8]}... failed to print";
            
            var icon = success ? ToolTipIcon.Info : ToolTipIcon.Error;
            
            ShowBalloonTip(title, message, icon);
        }
        
        public void ShowConnectionStatusChange(bool connected)
        {
            var title = connected ? "Connected" : "Disconnected";
            var message = connected 
                ? "PrintCloudClient connected to server"
                : "PrintCloudClient disconnected from server";
            
            var icon = connected ? ToolTipIcon.Info : ToolTipIcon.Warning;
            
            ShowBalloonTip(title, message, icon);
            UpdateTrayIconStatus(connected);
        }

        public void UpdateStatusText(string text)
        {
            _statusText = text;
            if (_statusMenuItem != null)
            {
                _statusMenuItem.Text = _statusText;
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
                    try
                    {
                        if (_notifyIcon != null)
                        {
                            _notifyIcon.Visible = false;
                            _notifyIcon.Dispose();
                        }
                        
                        _contextMenu?.Dispose();
                        
                        Logger.LogInfo("System tray manager disposed");
                    }
                    catch (Exception ex)
                    {
                        Logger.LogError("Error disposing tray manager", ex);
                    }
                }
                
                _disposed = true;
            }
        }
        
        ~TrayManager()
        {
            Dispose(false);
        }
    }
}
