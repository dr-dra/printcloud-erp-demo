using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using PrintCloudClient.Models;

namespace PrintCloudClient
{
    public partial class PrinterSelectionDialog : Form
    {
        private List<Printer> _availablePrinters = new List<Printer>();
        private string _documentType = "";
        private string _requiredPrinterType = "standard";
        private string _originalPrinterName = "";
        
        // UI Controls
        private Label lblMessage = null!;
        private Label lblDocumentType = null!;
        private Label lblOriginalPrinter = null!;
        private Label lblPrinterType = null!;
        private ComboBox cmbPrinters = null!;
        private Label lblSimilarityScore = null!;
        private Label lblCopiesLabel = null!;
        private NumericUpDown numCopies = null!;
        private Button btnPrint = null!;
        private Button btnCancel = null!;
        private GroupBox grpPrinterInfo = null!;
        private Label lblSelectedPrinterInfo = null!;
        
        public Printer? SelectedPrinter { get; private set; }
        public int Copies { get; private set; } = 1;
        public bool UserConfirmed { get; private set; } = false;

        public PrinterSelectionDialog()
        {
            InitializeComponent();
        }

        public void ConfigureDialog(string documentType, string originalPrinterName, List<Printer> availablePrinters, int defaultCopies = 1, string? requiredPrinterType = null)
        {
            _documentType = documentType;
            _originalPrinterName = originalPrinterName;
            _availablePrinters = availablePrinters.Where(p => p.Status == "online").ToList();
            
            // Determine required printer type based on document type
            if (!string.IsNullOrWhiteSpace(requiredPrinterType))
            {
                _requiredPrinterType = requiredPrinterType;
            }
            else if (documentType.Equals("receipt", StringComparison.OrdinalIgnoreCase))
            {
                _requiredPrinterType = "pos";
            }
            else
            {
                _requiredPrinterType = "standard";
            }
            
            // Filter printers by required type
            _availablePrinters = _availablePrinters.Where(p => p.PrinterType == _requiredPrinterType).ToList();
            
            UpdateUI();
            numCopies.Value = defaultCopies;
            
            // Calculate similarity scores and sort printers
            CalculateAndSortPrinters();
        }

        private void InitializeComponent()
        {
            Text = "Printer Selection";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            Size = new Size(500, 400);
            
            var mainPanel = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 6,
                Padding = new Padding(15)
            };
            
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize)); // Message
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize)); // Document info
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize)); // Printer selection
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize)); // Printer info
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize)); // Copies
            mainPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize)); // Buttons
            
            // Message
            lblMessage = new Label
            {
                Text = "Your default printer is not available. Please select an alternative printer:",
                Font = new Font(Font, FontStyle.Bold),
                ForeColor = Color.DarkRed,
                AutoSize = false,
                Height = 40,
                TextAlign = ContentAlignment.MiddleLeft,
                Dock = DockStyle.Fill
            };
            mainPanel.Controls.Add(lblMessage, 0, 0);
            
            // Document info panel
            var docInfoPanel = new Panel
            {
                Height = 80,
                Dock = DockStyle.Fill
            };
            
            lblDocumentType = new Label
            {
                Text = "Document Type: ",
                Location = new Point(0, 5),
                AutoSize = true
            };
            
            lblOriginalPrinter = new Label
            {
                Text = "Original Printer: ",
                Location = new Point(0, 25),
                AutoSize = true
            };
            
            lblPrinterType = new Label
            {
                Text = "Required Printer Type: ",
                Location = new Point(0, 45),
                AutoSize = true
            };
            
            docInfoPanel.Controls.AddRange(new Control[] { lblDocumentType, lblOriginalPrinter, lblPrinterType });
            mainPanel.Controls.Add(docInfoPanel, 0, 1);
            
            // Printer selection panel
            var printerPanel = new Panel
            {
                Height = 80,
                Dock = DockStyle.Fill
            };
            
            var lblSelectPrinter = new Label
            {
                Text = "Select Alternative Printer:",
                Font = new Font(Font, FontStyle.Bold),
                Location = new Point(0, 5),
                AutoSize = true
            };
            
            cmbPrinters = new ComboBox
            {
                Location = new Point(0, 30),
                Width = 400,
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbPrinters.SelectedIndexChanged += CmbPrinters_SelectedIndexChanged;
            
            lblSimilarityScore = new Label
            {
                Text = "",
                Location = new Point(0, 55),
                AutoSize = true,
                ForeColor = Color.Blue
            };
            
            printerPanel.Controls.AddRange(new Control[] { lblSelectPrinter, cmbPrinters, lblSimilarityScore });
            mainPanel.Controls.Add(printerPanel, 0, 2);
            
            // Printer info group
            grpPrinterInfo = new GroupBox
            {
                Text = "Selected Printer Information",
                Height = 80,
                Dock = DockStyle.Fill
            };
            
            lblSelectedPrinterInfo = new Label
            {
                Text = "No printer selected",
                Location = new Point(10, 25),
                AutoSize = false,
                Size = new Size(400, 40),
                ForeColor = Color.Gray
            };
            
            grpPrinterInfo.Controls.Add(lblSelectedPrinterInfo);
            mainPanel.Controls.Add(grpPrinterInfo, 0, 3);
            
            // Copies panel
            var copiesPanel = new Panel
            {
                Height = 40,
                Dock = DockStyle.Fill
            };
            
            lblCopiesLabel = new Label
            {
                Text = "Number of Copies:",
                Location = new Point(0, 10),
                AutoSize = true
            };
            
            numCopies = new NumericUpDown
            {
                Location = new Point(120, 8),
                Width = 60,
                Minimum = 1,
                Maximum = 99,
                Value = 1
            };
            
            copiesPanel.Controls.AddRange(new Control[] { lblCopiesLabel, numCopies });
            mainPanel.Controls.Add(copiesPanel, 0, 4);
            
            // Buttons panel
            var buttonsPanel = new Panel
            {
                Height = 40,
                Dock = DockStyle.Fill
            };
            
            btnCancel = new Button
            {
                Text = "Cancel",
                Size = new Size(80, 30),
                Location = new Point(0, 5),
                DialogResult = DialogResult.Cancel
            };
            btnCancel.Click += BtnCancel_Click;
            
            btnPrint = new Button
            {
                Text = "Print",
                Size = new Size(80, 30),
                Location = new Point(90, 5),
                Enabled = false
            };
            btnPrint.Click += BtnPrint_Click;
            
            buttonsPanel.Controls.AddRange(new Control[] { btnCancel, btnPrint });
            mainPanel.Controls.Add(buttonsPanel, 0, 5);
            
            Controls.Add(mainPanel);
            
            // Set default buttons
            AcceptButton = btnPrint;
            CancelButton = btnCancel;
        }

        private void UpdateUI()
        {
            lblDocumentType.Text = $"Document Type: {_documentType}";
            lblOriginalPrinter.Text = $"Original Printer: {_originalPrinterName}";
            lblPrinterType.Text = $"Required Printer Type: {(_requiredPrinterType == "pos" ? "POS/Thermal" : "Standard")}";
            
            if (!_availablePrinters.Any())
            {
                if (_requiredPrinterType == "pos")
                {
                    lblMessage.Text = "No compatible POS/thermal printers are currently online.";
                    lblMessage.ForeColor = Color.Red;
                }
                else
                {
                    lblMessage.Text = "No compatible standard printers are currently online.";
                    lblMessage.ForeColor = Color.Red;
                }
                
                cmbPrinters.Enabled = false;
                btnPrint.Enabled = false;
                lblSimilarityScore.Text = "Cannot print - no compatible printers available";
                lblSimilarityScore.ForeColor = Color.Red;
            }
            else
            {
                lblMessage.Text = "Your default printer is not available. Please select an alternative printer:";
                lblMessage.ForeColor = Color.DarkRed;
                cmbPrinters.Enabled = true;
            }
        }

        private void CalculateAndSortPrinters()
        {
            if (!_availablePrinters.Any()) return;
            
            // Calculate similarity scores for each printer
            var printersWithScores = new List<(Printer printer, int score)>();
            
            foreach (var printer in _availablePrinters)
            {
                var score = CalculatePrinterSimilarity(_originalPrinterName, _requiredPrinterType, printer);
                printersWithScores.Add((printer, score));
            }
            
            // Sort by similarity score (descending), then by name
            printersWithScores.Sort((a, b) => 
            {
                int scoreCompare = b.score.CompareTo(a.score);
                return scoreCompare != 0 ? scoreCompare : string.Compare(a.printer.Name, b.printer.Name, StringComparison.OrdinalIgnoreCase);
            });
            
            // Populate combo box
            cmbPrinters.Items.Clear();
            foreach (var (printer, score) in printersWithScores)
            {
                var displayText = $"{printer.Name} (Match: {score}%)";
                var item = new PrinterComboBoxItem(printer, score, displayText);
                cmbPrinters.Items.Add(item);
            }
            
            // Select the best match by default
            if (cmbPrinters.Items.Count > 0)
            {
                cmbPrinters.SelectedIndex = 0;
            }
        }

        private int CalculatePrinterSimilarity(string targetPrinterName, string targetPrinterType, Printer candidatePrinter)
        {
            if (string.IsNullOrEmpty(targetPrinterName) || candidatePrinter == null)
                return 0;

            var score = 0;
            var targetNameLower = targetPrinterName.ToLowerInvariant();
            var candidateNameLower = candidatePrinter.Name.ToLowerInvariant();

            // Printer type match (highest priority) - 40 points
            if (candidatePrinter.PrinterType == targetPrinterType)
            {
                score += 40;
            }

            // Exact name match - 30 points
            if (targetNameLower == candidateNameLower)
            {
                score += 30;
            }
            // Partial name match - 20 points
            else if (targetNameLower.Contains(candidateNameLower) || candidateNameLower.Contains(targetNameLower))
            {
                score += 20;
            }
            // Brand match (first word) - 15 points
            else if (targetNameLower.Split(' ').Length > 0 && candidateNameLower.Split(' ').Length > 0)
            {
                var targetBrand = targetNameLower.Split(' ')[0];
                var candidateBrand = candidateNameLower.Split(' ')[0];
                if (targetBrand == candidateBrand && targetBrand.Length > 2) // Avoid matching very short words
                {
                    score += 15;
                }
            }

            // Driver similarity - 15 points
            if (!string.IsNullOrEmpty(candidatePrinter.Driver) && !string.IsNullOrEmpty(targetPrinterName))
            {
                var candidateDriverLower = candidatePrinter.Driver.ToLowerInvariant();
                var targetWords = targetNameLower.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var driverWords = candidateDriverLower.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                
                var commonWords = targetWords.Intersect(driverWords).Where(w => w.Length > 2).Count();
                if (commonWords > 0)
                {
                    score += Math.Min(15, commonWords * 5);
                }
            }

            // Status bonus - 15 points for online printers
            if (candidatePrinter.Status == "online")
            {
                score += 15;
            }

            return Math.Min(score, 100); // Cap at 100%
        }

        private void CmbPrinters_SelectedIndexChanged(object? sender, EventArgs e)
        {
            if (cmbPrinters.SelectedItem is PrinterComboBoxItem item)
            {
                SelectedPrinter = item.Printer;
                btnPrint.Enabled = true;
                
                // Update similarity score display
                if (item.Score >= 70)
                {
                    lblSimilarityScore.Text = $"Excellent match: {item.Score}% similarity";
                    lblSimilarityScore.ForeColor = Color.Green;
                }
                else if (item.Score >= 50)
                {
                    lblSimilarityScore.Text = $"Good match: {item.Score}% similarity";
                    lblSimilarityScore.ForeColor = Color.Orange;
                }
                else
                {
                    lblSimilarityScore.Text = $"Basic match: {item.Score}% similarity";
                    lblSimilarityScore.ForeColor = Color.Red;
                }
                
                // Update printer info display
                var printerInfo = $"Name: {item.Printer.Name}\n";
                printerInfo += $"Type: {(item.Printer.PrinterType == "pos" ? "POS/Thermal" : "Standard")}\n";
                printerInfo += $"Status: {item.Printer.Status}\n";
                
                if (!string.IsNullOrEmpty(item.Printer.Driver))
                {
                    printerInfo += $"Driver: {item.Printer.Driver}\n";
                }
                
                // Add port information if available
                if (item.Printer.Capabilities.TryGetValue("port_name", out var portObj))
                {
                    var port = portObj?.ToString();
                    if (!string.IsNullOrEmpty(port))
                    {
                        printerInfo += $"Port: {port}";
                    }
                }
                
                lblSelectedPrinterInfo.Text = printerInfo;
                lblSelectedPrinterInfo.ForeColor = Color.Black;
            }
            else
            {
                SelectedPrinter = null;
                btnPrint.Enabled = false;
                lblSimilarityScore.Text = "";
                lblSelectedPrinterInfo.Text = "No printer selected";
                lblSelectedPrinterInfo.ForeColor = Color.Gray;
            }
        }

        private void BtnPrint_Click(object? sender, EventArgs e)
        {
            if (SelectedPrinter == null)
            {
                MessageBox.Show("Please select a printer.", "No Printer Selected", 
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            
            Copies = (int)numCopies.Value;
            UserConfirmed = true;
            DialogResult = DialogResult.OK;
            Close();
        }

        private void BtnCancel_Click(object? sender, EventArgs e)
        {
            UserConfirmed = false;
            DialogResult = DialogResult.Cancel;
            Close();
        }
        
        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            
            // Focus on the printer combo box for keyboard navigation
            cmbPrinters.Focus();
        }
    }

    // Helper class for ComboBox items
    public class PrinterComboBoxItem
    {
        public Printer Printer { get; }
        public int Score { get; }
        public string DisplayText { get; }

        public PrinterComboBoxItem(Printer printer, int score, string displayText)
        {
            Printer = printer;
            Score = score;
            DisplayText = displayText;
        }

        public override string ToString()
        {
            return DisplayText;
        }
    }
}
