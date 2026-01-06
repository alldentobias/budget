from typing import List, Dict, Any
import pandas as pd
import io

from app.schemas import ExtractedTransaction


# Registry of available extractors
EXTRACTORS: Dict[str, Dict[str, Any]] = {}


def register_extractor(name: str, description: str, formats: List[str]):
    """Decorator to register an extractor function"""
    def decorator(func):
        EXTRACTORS[name] = {
            "name": name,
            "description": description,
            "formats": formats,
            "function": func
        }
        return func
    return decorator


def get_available_extractors() -> List[Dict[str, str]]:
    """Get list of all registered extractors"""
    return [
        {
            "name": info["name"],
            "description": info["description"],
            "supported_formats": info["formats"]
        }
        for info in EXTRACTORS.values()
    ]


def run_extractor(name: str, file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    """Run a specific extractor on the file content"""
    if name not in EXTRACTORS:
        raise ValueError(f"Unknown extractor: {name}. Available: {list(EXTRACTORS.keys())}")
    
    return EXTRACTORS[name]["function"](file_content, filename)


# Import all extractor modules to register them
from app.extractors.generic_csv import *
from app.extractors.norwegian_banks import *

