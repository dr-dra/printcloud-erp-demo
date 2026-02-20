#!/bin/bash
# Simple syntax checker for C# files on non-Windows platforms
# This won't build the application but will catch basic syntax errors

echo "Checking C# syntax (Windows Forms build requires Windows)..."
echo "=================================================="

# Check if dotnet is available
if ! command -v dotnet &> /dev/null; then
    echo "❌ .NET SDK not found. Please install .NET SDK to check syntax."
    exit 1
fi

# List all C# files
echo "📁 Found C# files:"
find . -name "*.cs" -type f | sed 's|./||' | sort

echo ""
echo "🔍 Syntax check results:"
echo "========================"

# Try a dry-run build to catch syntax errors
dotnet build --dry-run --verbosity quiet 2>&1 | head -20

# Also check individual files with basic compilation
echo ""
echo "📝 Individual file checks:"
for file in *.cs Models/*.cs 2>/dev/null; do
    if [[ -f "$file" ]]; then
        echo -n "  $file: "
        # Basic syntax check using csc if available, otherwise skip
        if command -v csc &> /dev/null; then
            csc /t:library /nologo "$file" 2>&1 | head -1 || echo "✅ OK"
        else
            echo "⚠️  Skipped (csc not available)"
        fi
    fi
done

echo ""
echo "ℹ️  Note: Full compilation requires Windows with .NET Windows Desktop SDK"
echo "ℹ️  To build: Use Windows and run 'dotnet build --configuration Release'"