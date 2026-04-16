"""
Quick test to verify FastAPI app can start without errors
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.main import app
    from app.core.config import settings
    from app.core.log_config import setup_logging
    
    print("✓ All imports successful")
    print(f"✓ FastAPI app created: {app.title}")
    print(f"✓ Settings loaded: Environment={settings.ENVIRONMENT}")
    print(f"✓ Log level: {settings.LOG_LEVEL}")
    print("\n✓✓✓ Backend startup test PASSED ✓✓✓")
    
except Exception as e:
    print(f"✗ Error during startup test: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
