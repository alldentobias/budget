"""
Handelsbanken Extractors
Handles Excel exports for Handelsbanken Credit Card and Account.

All amounts are returned in minor units (øre/cents):
  - 12.50 kr -> 1250
  - 100.00 kr -> 10000
"""

import io

import pandas as pd

from app.extractors import register_extractor
from app.extractors.norwegian_banks import parse_date, parse_norwegian_amount
from app.schemas import ExtractedTransaction


def _parse_norwegian_date(date_val) -> str:
    """Parse Handelsbanken dates (DD.MM.YYYY), falling back to generic parsing."""
    if isinstance(date_val, str):
        try:
            return pd.to_datetime(date_val, dayfirst=True).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            return parse_date(date_val)
    return parse_date(date_val)


@register_extractor(
    name="handelsbanken_credit",
    description="Handelsbanken Credit Card (transaksjoner.xlsx)",
    formats=["xlsx", "xls"],
)
def extract_handelsbanken_credit(file_content: bytes, filename: str) -> list[ExtractedTransaction]:
    """
    Extract transactions from Handelsbanken Credit Card export.
    Columns: Dato, Beskrivelse, Inn på konto, Ut fra konto, Originalt beløp, Valuta, Kurs
    Date format: DD.MM.YYYY
    Amounts are in NOK (Ut fra konto), negative for expenses.
    Only processes outgoing transactions (Ut fra konto < 0).
    """
    df = pd.read_excel(io.BytesIO(file_content))

    # Select required columns
    required_cols = ["Dato", "Beskrivelse", "Inn på konto", "Ut fra konto"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")

    df = df[required_cols]

    # Filter only outgoing transactions (expenses)
    df = df[df["Ut fra konto"] < 0]

    transactions = []
    for _, row in df.iterrows():
        transactions.append(
            ExtractedTransaction(
                date=_parse_norwegian_date(row["Dato"]),
                title=str(row["Beskrivelse"]).strip(),
                amount=parse_norwegian_amount(row["Ut fra konto"]),
                source="Handelsbanken Credit",
                raw_data=row.to_json(),
            )
        )

    return transactions


@register_extractor(
    name="handelsbanken_account",
    description="Handelsbanken Account (Transaksjoner.xlsx)",
    formats=["xlsx", "xls"],
)
def extract_handelsbanken_account(file_content: bytes, filename: str) -> list[ExtractedTransaction]:
    """
    Extract transactions from Handelsbanken Account export.
    Columns include: Utført dato, Beskrivelse, Beløp inn, Beløp ut, Valuta, Status
    Date format: DD.MM.YYYY
    Amounts in Beløp ut are negative for expenses.
    Only processes outgoing transactions (Beløp ut < 0).
    Skips pending ("Reservert") rows, which would otherwise duplicate the
    booked transaction once it settles.
    """
    df = pd.read_excel(io.BytesIO(file_content))

    # Select required columns
    required_cols = ["Utført dato", "Beskrivelse", "Beløp ut"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")

    keep_cols = required_cols + (["Status"] if "Status" in df.columns else [])
    df = df[keep_cols]

    # Filter only outgoing transactions (expenses)
    df = df[df["Beløp ut"] < 0]

    # Skip pending transactions to avoid duplicating the eventual booked row
    if "Status" in df.columns:
        df = df[df["Status"].astype(str).str.strip().str.lower() != "reservert"]

    transactions = []
    for _, row in df.iterrows():
        transactions.append(
            ExtractedTransaction(
                date=_parse_norwegian_date(row["Utført dato"]),
                title=str(row["Beskrivelse"]).strip(),
                amount=parse_norwegian_amount(row["Beløp ut"]),
                source="Handelsbanken Account",
                raw_data=row.to_json(),
            )
        )

    return transactions
