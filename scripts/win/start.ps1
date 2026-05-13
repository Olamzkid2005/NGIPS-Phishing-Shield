<#
.SYNOPSIS
    NGIPS Phishing Shield - Start Script (Windows PowerShell)
    
.DESCRIPTION
    Starts all required services for the NGIPS Phishing Shield application.
    Performs pre-flight checks before starting services.

.PARAMETER SkipChecks
    Skip pre-flight checks and start services directly

.PARAMETER Dev
    Start in development mode with watch mode enabled

.EXAMPLE
    .\start.ps1
    .\start.ps1 -Dev
    .\start.ps1 -SkipChecks
#>

param(
    [switch]$SkipChecks,
    [switch]$Dev
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Resolve project root (go up from scripts/win to project root)
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path

# Colors for output
function Write-Step { param([string]$Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor White }

# Service configuration
$Services = @(
    @{
        Name = "Backend API"
        Dir = "$ProjectRoot\backend"
        Port = 8000
        StartScript = if ($Dev) { "npm run dev" } else { "npm start" }
        HealthEndpoint = "http://localhost:8000/health"
    },
    @{
        Name = "Dashboard"
        Dir = "$ProjectRoot\dashboard"
        Port = 5173
        StartScript = if ($Dev) { "npm run dev" } else { "npm run dev" }
        HealthEndpoint = "http://localhost:5173"
    }
)

$PIDs = @()

function Test-NodeInstalled {
    Write-Info "Checking Node.js installation..."
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Success "Node.js installed: $nodeVersion"
            return $true
        }
    } catch {
        Write-Fail "Node.js is not installed or not in PATH"
        return $false
    }
}

function Test-PythonInstalled {
    Write-Info "Checking Python installation..."
    try {
        $pyVersion = python --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $pyVersion) {
            Write-Success "Python installed: $pyVersion"
            return $true
        }
        # Try python3
        $py3Version = python3 --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $py3Version) {
            Write-Success "Python installed: $py3Version"
            return $true
        }
    } catch {
        Write-Fail "Python is not installed or not in PATH"
        return $false
    }
}

function Test-NodeModules {
    param([string]$Dir)
    
    Write-Info "Checking node_modules in $Dir..."
    $nodeModulesPath = Join-Path $Dir "node_modules"
    
    if (Test-Path $nodeModulesPath) {
        Write-Success "node_modules found"
        return $true
    } else {
        Write-Fail "node_modules not found. Run 'npm install' in $Dir"
        return $false
    }
}

function Test-NpmPackages {
    param([string]$Dir, [string[]]$Packages)
    
    Write-Info "Checking required npm packages..."
    $packageJson = Join-Path $Dir "package.json"
    
    if (-not (Test-Path $packageJson)) {
        Write-Fail "package.json not found"
        return $false
    }
    
    $content = Get-Content $packageJson -Raw | ConvertFrom-Json
    $allFound = $true
    
    foreach ($pkg in $Packages) {
        $found = $false
        if ($content.dependencies.$pkg) { $found = $true }
        if ($content.devDependencies.$pkg) { $found = $true }
        
        if ($found) {
            Write-Info "  $pkg - found"
        } else {
            Write-Warn "  $pkg - NOT FOUND"
            $allFound = $false
        }
    }
    
    return $allFound
}

function Test-PortAvailable {
    param([int]$Port)
    
    Write-Info "Checking if port $Port is available..."
    $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -WarningAction SilentlyContinue
    
    if ($connection.TcpTestSucceeded) {
        Write-Warn "Port $Port is in use"
        return $false
    } else {
        Write-Success "Port $Port is available"
        return $true
    }
}

function Test-ServiceHealth {
    param([string]$Name, [string]$Endpoint)
    
    Write-Info "Checking $Name health at $Endpoint..."
    
    try {
        $response = Invoke-WebRequest -Uri $Endpoint -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "$Name is healthy"
            return $true
        }
    } catch {
        Write-Warn "$Name health check failed or not responding"
    }
    return $false
}

function Start-ServiceWithRetry {
    param([string]$Name, [string]$Dir, [string]$StartScript, [int]$Port, [int]$MaxRetries = 3)
    
    Write-Step "Starting $Name on port $Port..."
    
    # Check port first
    $portAvailable = Test-PortAvailable -Port $Port
    if (-not $portAvailable) {
        Write-Warn "Port $Port is in use. Trying to stop existing process..."
        
        # Try to find and kill process on port
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
            ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } |
            Select-Object -First 1
            
        if ($process) {
            Write-Info "Stopping existing process: $($process.ProcessName) (PID: $($process.Id))"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            
            # Retry port check
            $portAvailable = Test-PortAvailable -Port $Port
            if (-not $portAvailable) {
                Write-Fail "Could not free port $Port. Skipping $Name..."
                return $null
            }
        }
    }
    
    # Start the service
    Push-Location $Dir
    
    try {
        if ($Name -eq "Backend API") {
            # Start backend directly with node
            $process = Start-Process -FilePath "node" -ArgumentList "src/server.js" -PassThru -WindowStyle Normal
        } else {
            # Start dashboard using cmd (more reliable)
            $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -PassThru -WindowStyle Normal
        }
        
        if ($process) {
            $Script:PIDs += [ordered]@{
                Name = $Name
                pid = $process.Id
                Port = $Port
            }
            Write-Success "Started $Name (PID: $($process.Id))"
            
            # Wait for service to initialize
            Start-Sleep -Seconds 3
            
            # Check if still running
            if (-not $process.HasExited) {
                return $true
            } else {
                Write-Fail "$Name process exited unexpectedly"
                return $false
            }
        }
    } catch {
        Write-Fail "Failed to start $Name : $_"
    } finally {
        Pop-Location
    }
}

function Stop-ServiceByPort {
    param([int]$Port)
    
    Write-Info "Stopping service on port $Port..."
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    
    if ($connections) {
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Info "Stopping process: $($process.ProcessName) (PID: $($process.Id))"
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
        Write-Success "Service on port $Port stopped"
        return $true
    }
    
    Write-Warn "No service found on port $Port"
    return $false
}

function Stop-ServiceByPID {
    param([int]$PID)
    
    try {
        $process = Get-Process -Id $PID -ErrorAction SilentlyContinue
        if ($process) {
            Write-Info "Stopping process: $($process.ProcessName) (PID: $PID)"
            Stop-Process -Id $PID -Force -ErrorAction SilentlyContinue
            Write-Success "Process $PID stopped"
            return $true
        }
    } catch {
        Write-Warn "Process $PID not found or already stopped"
    }
    return $false
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  NGIPS Phishing Shield - Start Script" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$ENV = if ($Dev) { "development" } else { "production" }
Write-Info "Environment: $ENV"
Write-Info "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Pre-flight checks
if (-not $SkipChecks) {
    Write-Step "Running pre-flight checks..."
    
    # Node.js check
    if (-not (Test-NodeInstalled)) {
        Write-Fail "Node.js is required but not installed"
        exit 1
    }
    
    # Check node_modules for each service
    $needsInstall = @()
    foreach ($service in $Services) {
        if (-not (Test-NodeModules -Dir $service.Dir)) {
            $needsInstall += $service.Dir
        }
    }
    
    # Install missing dependencies automatically
    if ($needsInstall.Count -gt 0) {
        Write-Warn "Missing node_modules detected. Installing dependencies..."
        foreach ($dir in $needsInstall) {
            Write-Info "Installing in $dir..."
            Push-Location $dir
            try {
                npm install --silent 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Dependencies installed in $dir"
                } else {
                    Write-Fail "Failed to install dependencies in $dir"
                }
            } finally {
                Pop-Location
            }
        }
    }
    
    Write-Success "Pre-flight checks completed"
} else {
    Write-Warn "Skipping pre-flight checks"
}

# Stop any existing services
Write-Step "Stopping any existing services..."

foreach ($service in $Services) {
    Stop-ServiceByPort -Port $service.Port | Out-Null
}

Start-Sleep -Seconds 1

# Start services
Write-Step "Starting services..."

$startedServices = @()

foreach ($service in $Services) {
    $result = Start-ServiceWithRetry -Name $service.Name -Dir $service.Dir -StartScript $service.StartScript -Port $service.Port
    
    if ($result) {
        $startedServices += $service
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Startup Summary" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

if ($startedServices.Count -gt 0) {
    Write-Success "$($startedServices.Count) service(s) started successfully:"
    
    foreach ($svc in $startedServices) {
        Write-Host "  - $($svc.Name): http://localhost:$($svc.Port)" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Dashboard available at: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "API available at: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "Health check: http://localhost:8000/health" -ForegroundColor Cyan
} else {
    Write-Fail "No services started"
    exit 1
}

# Save PIDs to file for stop script (save to project root)
$pidsFile = Join-Path $ProjectRoot ".service-pids.json"
$json = @{
    Timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
    Services = $PIDs
} | ConvertTo-Json -Depth 3

$json | Out-File -FilePath $pidsFile -Encoding UTF8

Write-Host ""
Write-Success "Startup complete!"
Write-Host ""
Write-Host "To stop services, run: .\stop.ps1" -ForegroundColor Yellow
Write-Host ""