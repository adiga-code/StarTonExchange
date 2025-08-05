#!/usr/bin/env python3
"""
Development runner script
Runs FastAPI server with hot reload
"""

import os
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Set development mode
    os.environ["DEVELOPMENT"] = "true"
    
    # Run with hot reload
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
        reload_dirs=["./"],
        reload_includes=["*.py"]
    )