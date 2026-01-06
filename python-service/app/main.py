from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import pandas as pd
import io
import importlib
import os

from app.schemas import ExtractedTransaction, ExtractionResponse
from app.extractors import get_available_extractors, run_extractor

app = FastAPI(
    title="Budget Extractor Service",
    description="Service for extracting transaction data from bank CSV/Excel files",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "python-extractor"}


@app.get("/extractors")
async def list_extractors():
    """List all available extraction scripts"""
    return {"extractors": get_available_extractors()}


@app.post("/extract", response_model=ExtractionResponse)
async def extract_transactions(
    file: UploadFile = File(...),
    extractor: str = Form(...)
):
    """
    Extract transactions from an uploaded file using the specified extractor.
    
    - **file**: CSV or Excel file from bank/credit card provider
    - **extractor**: Name of the extraction script to use
    """
    try:
        # Read file content
        content = await file.read()
        
        # Determine file type
        filename = file.filename or "unknown"
        
        # Run the extractor
        transactions = run_extractor(extractor, content, filename)
        
        return ExtractionResponse(
            success=True,
            message=f"Successfully extracted {len(transactions)} transactions",
            transactions=transactions,
            extractor_used=extractor
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/preview")
async def preview_file(file: UploadFile = File(...)):
    """
    Preview the first few rows of an uploaded file to help select the right extractor.
    """
    try:
        content = await file.read()
        filename = file.filename or "unknown"
        
        # Try to read as CSV first, then Excel
        try:
            if filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(content), nrows=10)
            else:
                df = pd.read_csv(io.BytesIO(content), nrows=10)
        except Exception:
            # Try with different encodings
            df = pd.read_csv(io.BytesIO(content), nrows=10, encoding='latin-1')
        
        return {
            "columns": list(df.columns),
            "rows": df.head(5).to_dict(orient="records"),
            "total_preview_rows": len(df)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not preview file: {str(e)}")


