NGIPS Phishing Shield - Service Management Scripts
===============================================

This directory contains scripts to start and stop all NGIPS services.

Prerequisites
------------
- Node.js 18+
- Python 3.8+ (optional, for ML service predictions)
- npm

Windows Usage
------------
Start services:
    .\start.ps1
    .\start.ps1 -Dev        # Start in development mode

Stop services:
    .\stop.ps1
    .\stop.ps1 -Force    # Force stop without confirmation

Linux/Mac Usage
---------------
Start services:
    ./start.sh
    ./start.sh -d        # Start in development mode

Stop services:
    ./stop.sh
    ./stop.sh -f         # Force stop without confirmation

Pre-flight Checks
------------------
The start script checks for:
1. Node.js installation
2. node_modules directories
3. Port availability
4. Required npm packages

To skip checks:
    .\start.ps1 -SkipChecks
    ./start.sh --skip-checks

Services Started
--------------
- Backend API:  http://localhost:8000
- Dashboard:   http://localhost:5173
- Health:      http://localhost:8000/health

Environment Variables
--------------------
Optional:
- JWT_SECRET        # JWT signing secret (required in production)
- ADMIN_API_KEY    # Admin API key
- DATABASE_URL   # Database connection (when using Prisma)

Files Created
------------
.startup.log     # Backend startup log
.service-pids.json # Saved process IDs (used by stop script)