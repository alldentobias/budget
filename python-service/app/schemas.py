from pydantic import BaseModel
from typing import List, Optional
from datetime import date


class ExtractedTransaction(BaseModel):
    """A single extracted transaction from a bank file"""
    date: str  # ISO format date string
    title: str
    amount: float  # Positive for expenses
    source: Optional[str] = None
    description: Optional[str] = None
    isShared: Optional[bool] = False
    raw_data: Optional[str] = None  # Original row data for reference
    

class ExtractionResponse(BaseModel):
    """Response from the extraction endpoint"""
    success: bool
    message: str
    transactions: List[ExtractedTransaction]
    extractor_used: str


class ExtractorInfo(BaseModel):
    """Information about an available extractor"""
    name: str
    description: str
    supported_formats: List[str]


