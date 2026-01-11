from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class ExtractedTransaction(BaseModel):
    """A single extracted transaction from a bank file"""
    date: str  # ISO format date string
    title: str
    amount: int  # Amount in minor units (øre/cents), e.g., 1250 = 12.50 kr
    source: str | None = None
    description: str | None = None
    isShared: bool | None = False
    raw_data: str | None = None  # Original row data for reference


class ExtractionResponse(BaseModel):
    """Response from the extraction endpoint"""
    success: bool
    message: str
    transactions: list[ExtractedTransaction]
    extractor_used: str


class ExtractorInfo(BaseModel):
    """Information about an available extractor"""
    name: str
    description: str
    supported_formats: list[str]
