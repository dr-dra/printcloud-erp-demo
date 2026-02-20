using System;
using System.IO;
using Microsoft.Win32;
using PrintCloudClient.Models;

namespace PrintCloudClient
{
    public class ConfigManager
    {
        private const string APP_NAME = "PrintCloudClient";
        private const string REGISTRY_KEY = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        private const string REGISTRY_VALUE_NAME = "PrintCloudClient";
        
        private readonly string _settingsDirectory;
        private readonly string _settingsFilePath;
        private Settings? _settings;
        
        public Settings Settings => _settings ??= LoadSettings();
        
        public ConfigManager()
        {
            _settingsDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                APP_NAME);
            
            _settingsFilePath = Path.Combine(_settingsDirectory, "settings.json");
            
            EnsureDirectoryExists();
        }
        
        private void EnsureDirectoryExists()
        {
            try
            {
                if (!Directory.Exists(_settingsDirectory))
                {
                    Directory.CreateDirectory(_settingsDirectory);
                    Logger.LogInfo($"Created settings directory: {_settingsDirectory}");
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to create settings directory", ex);
            }
        }
        
        private Settings LoadSettings()
        {
            try
            {
                var settings = Settings.Load(_settingsFilePath);
                Logger.LogInfo($"Settings loaded from: {_settingsFilePath}");
                return settings;
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to load settings, using defaults", ex);
                return CreateDefaultSettings();
            }
        }
        
        private Settings CreateDefaultSettings()
        {
            var settings = new Settings { SettingsFilePath = _settingsFilePath };
            
            try
            {
                settings.Save();
                Logger.LogInfo("Default settings created and saved");
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to save default settings", ex);
            }
            
            return settings;
        }
        
        public bool SaveSettings()
        {
            try
            {
                Settings.Save();
                Logger.LogInfo("Settings saved successfully");
                
                // Update auto-start setting
                UpdateAutoStartSetting();
                
                return true;
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to save settings", ex);
                return false;
            }
        }
        
        public bool SetAutoStartWithWindows(bool enabled)
        {
            try
            {
                Settings.AutoStartWithWindows = enabled;
                SaveSettings();
                return UpdateAutoStartSetting();
            }
            catch (Exception ex)
            {
                Logger.LogError($"Failed to set auto-start: {enabled}", ex);
                return false;
            }
        }
        
        private bool UpdateAutoStartSetting()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(REGISTRY_KEY, true);
                if (key == null)
                {
                    Logger.LogError("Cannot access Windows startup registry key");
                    return false;
                }
                
                if (Settings.AutoStartWithWindows)
                {
                    var exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                    if (exePath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
                    {
                        // For .NET Core apps, we need to use dotnet.exe
                        exePath = exePath.Replace(".dll", ".exe");
                    }
                    
                    key.SetValue(REGISTRY_VALUE_NAME, $"\"{exePath}\" --minimized");
                    Logger.LogInfo("Auto-start enabled");
                }
                else
                {
                    key.DeleteValue(REGISTRY_VALUE_NAME, false);
                    Logger.LogInfo("Auto-start disabled");
                }
                
                return true;
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to update auto-start registry setting", ex);
                return false;
            }
        }
        
        public bool IsAutoStartEnabled()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(REGISTRY_KEY, false);
                if (key == null) return false;
                
                var value = key.GetValue(REGISTRY_VALUE_NAME);
                return value != null;
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to check auto-start registry setting", ex);
                return false;
            }
        }
        
        public void UpdateApiEndpoint(string newEndpoint)
        {
            Settings.ApiEndpointUrl = newEndpoint.TrimEnd('/');
            SaveSettings();
            Logger.LogInfo($"API endpoint updated to: {newEndpoint}");
        }
        
        public void UpdateHeartbeatInterval(int seconds)
        {
            if (seconds < 10 || seconds > 300)
            {
                Logger.LogWarning($"Invalid heartbeat interval: {seconds}. Must be between 10 and 300 seconds.");
                return;
            }
            
            Settings.HeartbeatIntervalSeconds = seconds;
            SaveSettings();
            Logger.LogInfo($"Heartbeat interval updated to: {seconds} seconds");
        }
        
        public void UpdateJobPollingInterval(int seconds)
        {
            if (seconds < 5 || seconds > 120)
            {
                Logger.LogWarning($"Invalid job polling interval: {seconds}. Must be between 5 and 120 seconds.");
                return;
            }
            
            Settings.JobPollingIntervalSeconds = seconds;
            SaveSettings();
            Logger.LogInfo($"Job polling interval updated to: {seconds} seconds");
        }
        
        public void UpdatePrinterDiscoveryInterval(int seconds)
        {
            if (seconds < 30 || seconds > 600)
            {
                Logger.LogWarning($"Invalid printer discovery interval: {seconds}. Must be between 30 and 600 seconds.");
                return;
            }
            
            Settings.PrinterDiscoveryIntervalSeconds = seconds;
            SaveSettings();
            Logger.LogInfo($"Printer discovery interval updated to: {seconds} seconds");
        }
        
        public void SetPrinterMapping(string jobType, string printerName)
        {
            Settings.PrinterMappings[jobType] = printerName;
            SaveSettings();
            Logger.LogInfo($"Printer mapping set: {jobType} -> {printerName}");
        }
        
        public string? GetPrinterMapping(string jobType)
        {
            return Settings.PrinterMappings.TryGetValue(jobType, out var printerName) ? printerName : null;
        }
        
        public void ClearPrinterMapping(string jobType)
        {
            if (Settings.PrinterMappings.Remove(jobType))
            {
                SaveSettings();
                Logger.LogInfo($"Printer mapping cleared for: {jobType}");
            }
        }
        
        public void SetLogLevel(string level)
        {
            if (Enum.TryParse<LogLevel>(level, true, out var logLevel))
            {
                Settings.LogLevel = level;
                SaveSettings();
                Logger.SetLogLevel(logLevel);
                Logger.LogInfo($"Log level set to: {level}");
            }
            else
            {
                Logger.LogWarning($"Invalid log level: {level}");
            }
        }
        
        public string GetSettingsDirectory()
        {
            return _settingsDirectory;
        }
        
        public string GetSettingsFilePath()
        {
            return _settingsFilePath;
        }
        
        public void ResetToDefaults()
        {
            try
            {
                if (File.Exists(_settingsFilePath))
                {
                    File.Delete(_settingsFilePath);
                }
                
                _settings = CreateDefaultSettings();
                Logger.LogInfo("Settings reset to defaults");
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to reset settings to defaults", ex);
            }
        }
        
        public void ExportSettings(string filePath)
        {
            try
            {
                File.Copy(_settingsFilePath, filePath, true);
                Logger.LogInfo($"Settings exported to: {filePath}");
            }
            catch (Exception ex)
            {
                Logger.LogError($"Failed to export settings to {filePath}", ex);
                throw;
            }
        }
        
        public void ImportSettings(string filePath)
        {
            try
            {
                if (!File.Exists(filePath))
                {
                    throw new FileNotFoundException($"Settings file not found: {filePath}");
                }
                
                // Validate settings file first
                var testSettings = Settings.Load(filePath);
                
                // If validation passes, copy the file
                File.Copy(filePath, _settingsFilePath, true);
                
                // Reload settings
                _settings = LoadSettings();
                
                Logger.LogInfo($"Settings imported from: {filePath}");
            }
            catch (Exception ex)
            {
                Logger.LogError($"Failed to import settings from {filePath}", ex);
                throw;
            }
        }
    }
}