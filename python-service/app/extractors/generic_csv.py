import io
from typing import List

import pandas as pd

from app.extractors import register_extractor
from app.schemas import ExtractedTransaction


def to_minor_units(amount: float) -> int:
    """Convert amount from major units to minor units (øre/cents), rounding to integer"""
    return round(abs(amount) * 100)


@register_extractor(
    name="generic_csv",
    description="Generic CSV extractor - expects columns: date, description/title, amount",
    formats=["csv"],
)
def extract_generic_csv(file_content: bytes, filename: str) -> list[ExtractedTransaction]:
    """
    Generic CSV extractor that tries to intelligently parse common formats.
    Expects at minimum: a date column, a description/title column, and an amount column.
    Returns amounts in minor units (øre/cents).
    """
    # Try different encodings
    for encoding in ["utf-8", "latin-1", "iso-8859-1"]:
        try:
            df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Could not decode file with any known encoding")

    # Normalize column names
    df.columns = df.columns.str.lower().str.strip()

    # Find date column
    date_col = None
    for col in ["date", "datum", "transaction_date", "bokföringsdatum", "transaktionsdatum"]:
        if col in df.columns:
            date_col = col
            break

    if date_col is None:
        # Try to find a column that looks like dates
        for col in df.columns:
            try:
                pd.to_datetime(df[col].head(5))
                date_col = col
                break
            except:
                continue

    if date_col is None:
        raise ValueError("Could not find a date column")

    # Find description/title column
    desc_col = None
    for col in ["description", "title", "text", "beskrivning", "transaktion", "memo", "name"]:
        if col in df.columns:
            desc_col = col
            break

    if desc_col is None:
        # Use first text column that isn't the date
        for col in df.columns:
            if col != date_col and df[col].dtype == "object":
                desc_col = col
                break

    if desc_col is None:
        raise ValueError("Could not find a description column")

    # Find amount column
    amount_col = None
    for col in ["amount", "belopp", "sum", "summa", "value", "värde"]:
        if col in df.columns:
            amount_col = col
            break

    if amount_col is None:
        # Try to find a numeric column
        for col in df.columns:
            if col not in [date_col, desc_col]:
                try:
                    # Clean and convert to numeric
                    test_vals = df[col].astype(str).str.replace(",", ".").str.replace(" ", "")
                    pd.to_numeric(test_vals.head(5))
                    amount_col = col
                    break
                except:
                    continue

    if amount_col is None:
        raise ValueError("Could not find an amount column")

    transactions = []

    for _, row in df.iterrows():
        try:
            # Parse date
            date_val = pd.to_datetime(row[date_col])

            # Parse amount (handle Swedish format with comma as decimal)
            amount_str = str(row[amount_col]).replace(",", ".").replace(" ", "").replace("\xa0", "")
            amount = float(amount_str)

            # Get description
            title = str(row[desc_col]).strip()

            if pd.isna(date_val) or pd.isna(amount) or not title:
                continue

            transactions.append(
                ExtractedTransaction(
                    date=date_val.strftime("%Y-%m-%d"),
                    title=title,
                    amount=to_minor_units(amount),  # Convert to minor units
                    description=None,
                    raw_data=row.to_json(),
                )
            )
        except Exception:
            # Skip problematic rows
            continue

    return transactions
