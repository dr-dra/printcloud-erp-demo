using System;
using System.Threading;
using System.Windows.Forms;
using System.IO;

namespace PrintCloudClient
{
    internal static class Program
    {
        private static Mutex? mutex;
        
        [STAThread]
        static void Main()
        {
            // Ensure only one instance is running
            const string mutexName = "PrintCloudClient_SingleInstance";
            mutex = new Mutex(true, mutexName, out bool isNewInstance);
            
            if (!isNewInstance)
            {
                MessageBox.Show("PrintCloudClient is already running.", "PrintCloudClient", 
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            // Configure application
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            // Set up error handling
            Application.ThreadException += Application_ThreadException;
            AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;
            
            // Ensure log directory exists
            var logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), 
                "PrintCloudClient", "Logs");
            Directory.CreateDirectory(logDir);
            
            // Start the main form
            Application.Run(new MainForm());
            
            mutex?.ReleaseMutex();
        }
        
        private static void Application_ThreadException(object sender, ThreadExceptionEventArgs e)
        {
            LogError("Application Thread Exception", e.Exception);
            MessageBox.Show($"An error occurred: {e.Exception.Message}", "PrintCloudClient Error", 
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        
        private static void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            if (e.ExceptionObject is Exception ex)
            {
                LogError("Unhandled Exception", ex);
                MessageBox.Show($"A critical error occurred: {ex.Message}", "PrintCloudClient Critical Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        
        private static void LogError(string context, Exception exception)
        {
            try
            {
                var logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), 
                    "PrintCloudClient", "Logs");
                var logFile = Path.Combine(logDir, $"error_{DateTime.Now:yyyy-MM-dd}.log");
                
                var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {context}: {exception}\n";
                File.AppendAllText(logFile, logEntry);
            }
            catch
            {
                // If we can't log, at least show the error
            }
        }
    }
}