using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PrintCloudClient.Models
{
    public class Settings
    {
        public string ApiEndpointUrl { get; set; } = "http://localhost:8000/api/printcloudclient";
        public bool AutoStartWithWindows { get; set; } = true;
        public int HeartbeatIntervalSeconds { get; set; } = 30;
        public int JobPollingIntervalSeconds { get; set; } = 10;
        public int PrinterDiscoveryIntervalSeconds { get; set; } = 60;
        public Dictionary<string, string> PrinterMappings { get; set; } = new Dictionary<string, string>();
        public string LogLevel { get; set; } = "Info";
        
        [JsonIgnore]
        public string SettingsFilePath { get; set; } = "";
        
        public void Save()
        {
            if (!string.IsNullOrEmpty(SettingsFilePath))
            {
                var json = JsonConvert.SerializeObject(this, Formatting.Indented);
                System.IO.File.WriteAllText(SettingsFilePath, json);
            }
        }
        
        public static Settings Load(string filePath)
        {
            Settings settings;
            
            if (System.IO.File.Exists(filePath))
            {
                try
                {
                    var json = System.IO.File.ReadAllText(filePath);
                    settings = JsonConvert.DeserializeObject<Settings>(json) ?? new Settings();
                }
                catch
                {
                    settings = new Settings();
                }
            }
            else
            {
                settings = new Settings();
            }
            
            settings.SettingsFilePath = filePath;
            return settings;
        }
    }
}