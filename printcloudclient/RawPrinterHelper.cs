using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace PrintCloudClient
{
    public class RawPrinterHelper
    {
        // Structure and API declarations for raw printing
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DocInfoA
        {
            [MarshalAs(UnmanagedType.LPStr)]
            public string? pDocName;
            [MarshalAs(UnmanagedType.LPStr)]
            public string? pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)]
            public string? pDataType;
        }
        
        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfoA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        public bool SendBytesToPrinter(string printerName, byte[] bytes)
        {
            IntPtr hPrinter = IntPtr.Zero;
            DocInfoA di = new DocInfoA();
            bool success = false;
            int bytesWritten = 0;

            try
            {
                di.pDocName = "PrintCloudClient Raw Document";
                di.pDataType = "RAW";

                // Open the printer
                if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero))
                {
                    Logger.LogError($"Cannot open printer {printerName}");
                    return false;
                }

                // Start a document
                if (!StartDocPrinter(hPrinter, 1, di))
                {
                    Logger.LogError($"Cannot start document on printer {printerName}");
                    return false;
                }

                // Start a page
                if (!StartPagePrinter(hPrinter))
                {
                    Logger.LogError($"Cannot start page on printer {printerName}");
                    return false;
                }

                // Write the bytes to the printer
                IntPtr pBytes = Marshal.AllocHGlobal(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    success = WritePrinter(hPrinter, pBytes, bytes.Length, out bytesWritten);
                    
                    if (!success)
                    {
                        Logger.LogError($"Cannot write to printer {printerName}");
                        return false;
                    }
                    
                    if (bytesWritten != bytes.Length)
                    {
                        Logger.LogWarning($"Only wrote {bytesWritten} of {bytes.Length} bytes to printer {printerName}");
                    }
                }
                finally
                {
                    Marshal.FreeHGlobal(pBytes);
                }

                // End the page
                if (!EndPagePrinter(hPrinter))
                {
                    Logger.LogError($"Cannot end page on printer {printerName}");
                    return false;
                }

                // End the document
                if (!EndDocPrinter(hPrinter))
                {
                    Logger.LogError($"Cannot end document on printer {printerName}");
                    return false;
                }

                success = true;
            }
            catch (Exception ex)
            {
                Logger.LogError($"Exception in SendBytesToPrinter", ex);
                success = false;
            }
            finally
            {
                // Close the printer handle
                if (hPrinter != IntPtr.Zero)
                {
                    ClosePrinter(hPrinter);
                }
            }

            return success;
        }

        public bool SendStringToPrinter(string printerName, string text)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(text);
            return SendBytesToPrinter(printerName, bytes);
        }
        
        public bool SendFileToPrinter(string printerName, string filePath)
        {
            try
            {
                if (!File.Exists(filePath))
                {
                    Logger.LogError($"File not found: {filePath}");
                    return false;
                }
                
                byte[] bytes = File.ReadAllBytes(filePath);
                return SendBytesToPrinter(printerName, bytes);
            }
            catch (Exception ex)
            {
                Logger.LogError($"Error sending file to printer", ex);
                return false;
            }
        }
    }
}