"""
Pytest configuration and fixtures for extractor tests.
"""
import sys
from pathlib import Path

import pytest

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))



