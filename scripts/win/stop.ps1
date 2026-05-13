<#
.SYNOPSIS
    NGIPS Phishing Shield - Stop Script (Windows PowerShell)
    
.DESCRIPTION
    Stops all NGIPS Phishing Shield services.
    Uses PIDs from .service-pids.json if available, otherwise stops by port.

.PARAMETER Force
    Force kill all processes without confirmation

.PARAMETER All
    Stop all services including any found on default ports

.EXAMPLE
    .\stop.ps1
    .\stop.ps1 -Force
    .\stop.ps1 -All
#>

param(
    [switch]$Force,
    [switch]$All
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Resolve project root (go up from scripts/win to project root)
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path

# Colors for output
function Write-Step { param([string]$Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor White }

# Default ports
$DefaultPorts = @(8000, 5173)

function Stop-ServiceByPort {
    param([int]$Port)
    
    Write-Info "Checking port $Port..."
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
        Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" }
    
    if ($connections) {
        $stopped = $false
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Warn "Stopping $($process.ProcessName) (PID: $($process.Id)) on port $Port"
                try {
                    Stop-Process -Id $process.Id -Force -ErrorAction Stop
                    $stopped = $true
                } catch {
                    Write-Fail "Failed to stop process: $_"
                }
            }
        }
        
        if ($stopped) {
            Write-Success "Port $Port is now free"
            return $true
        }
    }
    
    Write-Info "No service found on port $Port"
    return $false
}

function Stop-ServiceByPID {
    param([int]$PID, [string]$Name)
    
    try {
        $process = Get-Process -Id $PID -ErrorAction SilentlyContinue
        if ($process) {
            Write-Warn "Stopping $Name (PID: $PID)"
            Stop-Process -Id $PID -Force -ErrorAction Stop
            Write-Success "Stopped $Name"
            return $true
        }
    } catch {
        Write-Info "Process $PID not found or already stopped"
    }
    return $false
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  NGIPS Phishing Shield - Stop Script" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$stoppedCount = 0

# Load PIDs from file if it exists (look in project root)
$pidsFile = Join-Path $ProjectRoot ".service-pids.json"

if (Test-Path $pidsFile) {
    Write-Step "Loading saved service PIDs..."
    
    try {
        $savedData = Get-Content $pidsFile -Raw | ConvertFrom-Json
        
        foreach ($svc in $savedData.Services) {
            if ($svc.pid) {
                $result = Stop-ServiceByPID -PID $svc.pid -Name $svc.Name
                if ($result) { $stoppedCount++ }
            }
        }
        
        # Remove the PIDs file
        Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
        Write-Info "Removed .service-pids.json"
        
    } catch {
        Write-Warn "Could not read .service-pids.json: $_"
    }
}

# Stop by port (default or --All)
$portsToStop = if ($All) { $DefaultPorts } else { $DefaultPorts }

foreach ($port in $portsToStop) {
    $result = Stop-ServiceByPort -Port $port
    if ($result) { $stoppedCount++ }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Stop Summary" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

if ($stoppedCount -gt 0) {
    Write-Success "$stoppedCount service(s) stopped"
} else {
    Write-Info "No services were running on default ports"
}

# Additional cleanup
Write-Step "Performing cleanup..."

# Kill any orphan node processes in project directory
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | 
    Where-Object { 
        $_.Path -like "*phishing-detection*" -or 
        $_.Path -like "*ngips*" 
    }

if ($nodeProcesses -and ($Force -or $All)) {
    Write-Warn "Found $($nodeProcesses.Count) orphan Node.js processes"
    
    if (-not $Force) {
        $confirm = Read-Host "Kill orphan processes? (y/N)"
        if ($confirm -ne "y") {
            Write-Info "Skipping orphan processes"
        } else {
            foreach ($proc in $nodeProcesses) {
                Stop-ServiceByPID -PID $proc.Id -Name $proc.ProcessName
                $stoppedCount++
            }
        }
    } else {
        foreach ($proc in $nodeProcesses) {
            Stop-ServiceByPID -PID $proc.Id -Name $proc.ProcessName
            $stoppedCount++
        }
    }
}

Write-Host ""

if ($stoppedCount -gt 0) {
    Write-Success "All services stopped successfully!"
} else {
    Write-Info "No services to stop"
}

Write-Host ""