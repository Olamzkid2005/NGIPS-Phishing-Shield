#!/bin/bash
#
# NGIPS Phishing Shield - Start Script (Linux/Mac)
# Performs pre-flight checks before starting services
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve project root (go up from scripts/linux/mac to project root)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$PROJECT_ROOT/.service-pids.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Service configuration
SERVICES=(
    "backend:8000:npm start"
    "dashboard:5173:npm run dev"
)

# Parse arguments
SKIP_CHECKS=false
DEV_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-checks|-s)
            SKIP_CHECKS=true
            shift
            ;;
        --dev|-d)
            DEV_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-checks, -s    Skip pre-flight checks"
            echo "  --dev, -d          Start in development mode"
            echo "  --help, -h         Show this help"
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

check_node() {
    log_info "Checking Node.js..."
    if command -v node &> /dev/null; then
        local version=$(node --version)
        log_ok "Node.js installed: $version"
        return 0
    else
        log_fail "Node.js is not installed"
        return 1
    fi
}

check_python() {
    log_info "Checking Python..."
    if command -v python3 &> /dev/null; then
        local version=$(python3 --version)
        log_ok "Python installed: $version"
        return 0
    elif command -v python &> /dev/null; then
        local version=$(python --version)
        log_ok "Python installed: $version"
        return 0
    else
        log_fail "Python is not installed"
        return 1
    fi
}

check_node_modules() {
    local dir="$1"
    log_info "Checking node_modules in $dir..."
    if [ -d "$dir/node_modules" ]; then
        log_ok "node_modules found"
        return 0
    else
        log_fail "node_modules not found. Run 'npm install' in $dir"
        return 1
    fi
}

check_port() {
    local port=$1
    log_info "Checking if port $port is available..."
    if lsof -i :$port &> /dev/null 2>&1; then
        log_warn "Port $port is in use"
        return 1
    else
        log_ok "Port $port is available"
        return 0
    fi
}

kill_port() {
    local port=$1
    log_info "Stopping service on port $port..."
    
    if lsof -ti :$port &> /dev/null 2>&1; then
        local pids=$(lsof -ti :$port)
        for pid in $pids; do
            log_info "Killing process $pid on port $port"
            kill $pid 2>/dev/null || true
        done
        sleep 1
        log_ok "Port $port freed"
        return 0
    fi
    
    log_info "No service found on port $port"
    return 0
}

start_service() {
    local name=$1
    local port=$2
    local cmd=$3
    
    log_step "Starting $name on port $port..."
    
    # Check if port is in use
    if lsof -i :$port &> /dev/null 2>&1; then
        log_warn "Port $port in use, attempting to free..."
        kill_port $port
    fi
    
    # Start the service
    cd "$PROJECT_ROOT/$name"
    
    # Run in background and disown
    nohup $cmd > "$PROJECT_ROOT/$name.log" 2>&1 &
    local pid=$!
    echo $pid > /dev/null
    
    log_ok "Started $name (PID: $pid)"
    
    # Wait for service to initialize
    sleep 3
    
    # Check if still running
    if kill -0 $pid 2>/dev/null; then
        return 0
    else
        log_fail "Service $name failed to start"
        return 1
    fi
}

# Main
echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  NGIPS Phishing Shield - Start Script${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo ""

ENV=$([ "$DEV_MODE" = true ] && echo "development" || echo "production")
log_info "Environment: $ENV"
log_info "Time: $(date '+%Y-%m-%d %H:%M:%S')"

# Pre-flight checks
if [ "$SKIP_CHECKS" = false ]; then
    log_step "Running pre-flight checks..."
    
    check_node || { log_fail "Node.js is required"; exit 1; }
    
    check_node_modules "$PROJECT_ROOT/backend" || log_warn "Install backend dependencies first"
    check_node_modules "$PROJECT_ROOT/dashboard" || log_warn "Install dashboard dependencies first"
    
    log_ok "Pre-flight checks completed"
else
    log_warn "Skipping pre-flight checks"
fi

# Stop any existing services
log_step "Stopping any existing services..."

for service in "${SERVICES[@]}"; do
    port="${service##*:}"
    kill_port $port || true
done

sleep 1

# Start services
log_step "Starting services..."

started=0

for service in "${SERVICES[@]}"; do
    name="${service%%:*}"
    port="${service%%:*}"
    port="${service##*:}"
    cmd="${service##*:}"
    
    # Update command for dev mode
    if [ "$DEV_MODE" = true ]; then
        if [ "$name" = "backend" ]; then
            cmd="npm run dev"
        else
            cmd="npm run dev"
        fi
    fi
    
    if start_service "$name" "$port" "$cmd"; then
        ((started++))
    fi
done

# Summary
echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  Startup Summary${NC}"
echo -e "${MAGENTA}========================================${NC}"

if [ $started -gt 0 ]; then
    log_ok "$started service(s) started:"
    echo -e "  ${GREEN}- Backend API: http://localhost:8000${NC}"
    echo -e "  ${GREEN}- Dashboard: http://localhost:5173${NC}"
    echo ""
    echo -e "${CYAN}Dashboard: http://localhost:5173${NC}"
    echo -e "${CYAN}API: http://localhost:8000${NC}"
    echo -e "${CYAN}Health: http://localhost:8000/health${NC}"
else
    log_fail "No services started"
    exit 1
fi

log_ok "Startup complete!"
echo ""
echo -e "${YELLOW}To stop services, run: ./stop.sh${NC}"
echo ""