import io
from typing import Any, Dict, List

import pandas as pd

from app.schemas import ExtractedTransaction

# Registry of available extractors
EXTRACTORS: dict[str, dict[str, Any]] = {}


def register_extractor(name: str, description: str, formats: list[str]):
    """Decorator to register an extractor function"""

    def decorator(func):
        EXTRACTORS[name] = {
            "name": name,
            "description": description,
            "formats": formats,
            "function": func,
        }
        return func

    return decorator


def get_available_extractors() -> list[dict[str, str]]:
    """Get list of all registered extractors"""
    return [
        {
            "name": info["name"],
            "description": info["description"],
            "supported_formats": info["formats"],
        }
        for info in EXTRACTORS.values()
    ]


def run_extractor(name: str, file_content: bytes, filename: str) -> list[ExtractedTransaction]:
    """Run a specific extractor on the file content"""
    if name not in EXTRACTORS:
        raise ValueError(f"Unknown extractor: {name}. Available: {list(EXTRACTORS.keys())}")

    transactions = EXTRACTORS[name]["function"](file_content, filename)

    # Sort by date and assign sortIndex
    sorted_transactions = sorted(transactions, key=lambda t: t.date)

    return [
        ExtractedTransaction(
            date=t.date,
            title=t.title,
            amount=t.amount,
            sortIndex=i,
            source=t.source,
            description=t.description,
            isShared=t.isShared,
            raw_data=t.raw_data,
        )
        for i, t in enumerate(sorted_transactions)
    ]


# Import all extractor modules to register them
from app.extractors.generic_csv import *
from app.extractors.norwegian_banks import *
