using System;
using System.IO;

namespace PrintCloudClient
{
    public enum LogLevel
    {
        Error,
        Warning,
        Info,
        Debug
    }
    
    public static class Logger
    {
        private static readonly object _lockObject = new object();
        private static string? _logDirectory;
        private static LogLevel _currentLogLevel = LogLevel.Info;
        private static DateTime _lastCleanupDate = DateTime.MinValue;
        
        static Logger()
        {
            _logDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "PrintCloudClient", "Logs");
            
            try
            {
                Directory.CreateDirectory(_logDirectory);
            }
            catch
            {
                _logDirectory = null;
            }
        }
        
        public static void SetLogLevel(LogLevel level)
        {
            _currentLogLevel = level;
        }
        
        public static void Log(string message, LogLevel level = LogLevel.Info)
        {
            if (level > _currentLogLevel || _logDirectory == null)
                return;
                
            try
            {
                lock (_lockObject)
                {
                    var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    var levelString = level.ToString().ToUpper();
                    var logEntry = $"[{timestamp}] [{levelString}] {message}\n";
                    
                    // Write to daily log file
                    var logFileName = $"printcloudclient_{DateTime.Now:yyyy-MM-dd}.log";
                    var logFilePath = Path.Combine(_logDirectory, logFileName);
                    
                    File.AppendAllText(logFilePath, logEntry);
                    
                    // Also write to console for debugging
                    Console.Write(logEntry);
                    
                    if (_lastCleanupDate.Date != DateTime.Today)
                    {
                        CleanupOldLogs();
                        _lastCleanupDate = DateTime.Today;
                    }
                }
            }
            catch
            {
                // If logging fails, don't throw - just continue
            }
        }
        
        public static void LogError(string message, Exception? exception = null)
        {
            var fullMessage = exception != null ? $"{message}: {exception}" : message;
            Log(fullMessage, LogLevel.Error);
        }
        
        public static void LogWarning(string message)
        {
            Log(message, LogLevel.Warning);
        }
        
        public static void LogInfo(string message)
        {
            Log(message, LogLevel.Info);
        }
        
        public static void LogDebug(string message)
        {
            Log(message, LogLevel.Debug);
        }
        
        private static void CleanupOldLogs()
        {
            try
            {
                if (_logDirectory == null)
                    return;
                    
                var logFiles = Directory.GetFiles(_logDirectory, "*.log");
                var cutoffDate = DateTime.Now.AddDays(-30);
                
                foreach (var logFile in logFiles)
                {
                    var fileInfo = new FileInfo(logFile);
                    if (fileInfo.CreationTime < cutoffDate)
                    {
                        File.Delete(logFile);
                    }
                }
            }
            catch
            {
                // If cleanup fails, don't worry about it
            }
        }
        
        public static string GetLogDirectory()
        {
            return _logDirectory ?? "";
        }
    }
}
