#!/bin/bash
#
# NGIPS Phishing Shield - Stop Script (Linux/Mac)
# Stops all NGIPS Phishing Shield services
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.service-pids.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default ports
PORTS=(8000 5173)

# Parse arguments
FORCE=false
KILL_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE=true
            shift
            ;;
        --all|-a)
            KILL_ALL=true
            FORCE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force, -f    Force kill without confirmation"
            echo "  --all, -a     Kill all processes on default ports (same as -f)"
            echo "  --help, -h    Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_info() { echo -e "${NC}[INFO]${NC} $1"; }

kill_port() {
    local port=$1
    log_info "Checking port $port..."
    
    if lsof -ti :$port &> /dev/null 2>&1; then
        local pids=$(lsof -ti :$port)
        killed=0
        
        for pid in $pids; do
            # Get process name
            local pname=$(ps -p $pid -o comm= 2>/dev/null | tr -d ' ')
            log_warn "Stopping $pname (PID: $pid) on port $port"
            
            kill $pid 2>/dev/null || true
            ((killed++))
        done
        
        sleep 1
        
        # Force kill if still running
        if lsof -ti :$port &> /dev/null 2>&1; then
            log_warn "Force killing remaining processes..."
            kill -9 $pids 2>/dev/null || true
        fi
        
        log_ok "Port $port is now free"
        return $killed
    fi
    
    log_info "No service found on port $port"
    return 0
}

kill_pid() {
    local pid=$1
    local name=$2
    
    if kill -0 $pid 2>/dev/null; then
        log_warn "Stopping $name (PID: $pid)"
        kill $pid 2>/dev/null || true
        sleep 1
        
        if kill -0 $pid 2>/dev/null; then
            log_warn "Force killing $name..."
            kill -9 $pid 2>/dev/null || true
        fi
        
        log_ok "Stopped $name"
        return 1
    fi
    
    log_info "Process $pid not found or already stopped"
    return 0
}

# Main
echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  NGIPS Phishing Shield - Stop Script${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo ""

stopped=0

# Try to load and use saved PIDs
if [ -f "$PID_FILE" ]; then
    log_step "Loading saved service PIDs..."
    
    if command -v jq &> /dev/null; then
        pids=$(jq -r '.services[].pid' "$PID_FILE" 2>/dev/null || echo "")
        
        for pid in $pids; do
            if [ -n "$pid" ] && [ "$pid" != "null" ]; then
                if kill_pid $pid "service"; then
                    ((stopped++))
                fi
            fi
        done
        
        rm -f "$PID_FILE"
        log_info "Removed $PID_FILE"
    else
        log_warn "jq not found, using port-based cleanup"
    fi
fi

# Stop by port
for port in "${PORTS[@]}"; do
    result=$(kill_port $port)
    stopped=$((stopped + result))
done

# Summary
echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  Stop Summary${NC}"
echo -e "${MAGENTA}========================================${NC}"

if [ $stopped -gt 0 ]; then
    log_ok "$stopped service(s) stopped"
else
    log_info "No services were running on default ports"
fi

# Additional cleanup
log_step "Performing additional cleanup..."

# Kill orphan node processes in project directory
if [ "$FORCE" = true ]; then
    orphan_pids=$(pgrep -f "phishing-detection|ngips" 2>/dev/null || echo "")
    
    if [ -n "$orphan_pids" ]; then
        log_warn "Found orphan Node.js processes"
        
        for pid in $orphan_pids; do
            pname=$(ps -p $pid -o comm= 2>/dev/null | tr -d ' ')
            log_warn "Stopping $pname (PID: $pid)"
            kill $pid 2>/dev/null || true
            ((stopped++))
        done
    fi
fi

echo ""

if [ $stopped -gt 0 ]; then
    log_ok "All services stopped successfully!"
else
    log_info "No services to stop"
fi

echo ""