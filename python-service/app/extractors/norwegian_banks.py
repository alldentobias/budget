"""
Norwegian Bank Extractors
Handles exports from DNB, American Express (Norway), and Sparebank1
"""
import pandas as pd
import io
from typing import List
from datetime import datetime

from app.schemas import ExtractedTransaction
from app.extractors import register_extractor


def parse_norwegian_amount(amount) -> float:
    """Parse Norwegian formatted amounts (comma as decimal separator)"""
    if pd.isna(amount):
        return 0.0
    if isinstance(amount, (int, float)):
        return abs(float(amount))
    # Handle string with comma as decimal separator
    amount_str = str(amount).replace(" ", "").replace(",", ".")
    try:
        return abs(float(amount_str))
    except ValueError:
        return 0.0


def parse_date(date_val) -> str:
    """Parse various date formats to YYYY-MM-DD"""
    if pd.isna(date_val):
        return datetime.now().strftime("%Y-%m-%d")
    if isinstance(date_val, str):
        # Try common formats
        for fmt in ["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(date_val, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_val
    if hasattr(date_val, 'strftime'):
        return date_val.strftime("%Y-%m-%d")
    return str(date_val)


@register_extractor(
    name="dnb_mastercard",
    description="DNB MasterCard Extraction",
    formats=["xlsx", "xls"]
)
def extract_dnb_mastercard(file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    """
    Extract transactions from DNB MasterCard export.
    Columns: Dato, Beløpet gjelder, Inn, Ut
    Only processes outgoing transactions (Ut column)
    """
    df = pd.read_excel(io.BytesIO(file_content))
    
    # Select required columns
    required_cols = ["Dato", "Beløpet gjelder", "Inn", "Ut"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")
    
    df = df[required_cols]
    
    # Filter only outgoing transactions (where Inn is null)
    df = df[df["Inn"].isnull()]
    df = df.drop("Inn", axis=1)
    
    transactions = []
    for _, row in df.iterrows():
        transactions.append(ExtractedTransaction(
            date=parse_date(row["Dato"]),
            title=str(row["Beløpet gjelder"]).strip(),
            amount=parse_norwegian_amount(row["Ut"]),
            source="DNB Credit",
            raw_data=row.to_json()
        ))
    
    return transactions


@register_extractor(
    name="amex_norway",
    description="American Express Norway (aktivitet.xlsx)",
    formats=["xlsx", "xls"]
)
def extract_amex_norway(file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    """
    Extract transactions from American Express Norway export.
    Header is at row 6 (0-indexed: header=6)
    Columns: Dato, Beskrivelse, Beløp
    """
    df = pd.read_excel(io.BytesIO(file_content), header=6)
    
    # Select required columns
    required_cols = ["Dato", "Beskrivelse", "Beløp"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")
    
    df = df[required_cols]
    df = df.dropna(subset=["Dato", "Beskrivelse"])
    
    transactions = []
    for _, row in df.iterrows():
        transactions.append(ExtractedTransaction(
            date=parse_date(row["Dato"]),
            title=str(row["Beskrivelse"]).strip(),
            amount=parse_norwegian_amount(row["Beløp"]),
            source="Amex",
            raw_data=row.to_json()
        ))
    
    return transactions


@register_extractor(
    name="sb1_credit",
    description="Sparebank1 MasterCard Credit (transactions.csv)",
    formats=["csv"]
)
def extract_sb1_credit(file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    """
    Extract transactions from Sparebank1 Credit Card export.
    CSV with semicolon separator and comma decimal
    Columns: Kjøpsdato, Beskrivelse, Beløp
    Only processes negative amounts (expenses)
    """
    # Try different encodings
    for encoding in ['utf-8', 'latin-1', 'iso-8859-1']:
        try:
            df = pd.read_csv(
                io.BytesIO(file_content),
                sep=';',
                decimal=',',
                encoding=encoding
            )
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Could not decode file with any supported encoding")
    
    # Select required columns
    required_cols = ['Kjøpsdato', 'Beskrivelse', 'Beløp']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")
    
    df = df[required_cols]
    
    # Filter only negative amounts (expenses)
    df = df[df['Beløp'] < 0]
    
    transactions = []
    for _, row in df.iterrows():
        transactions.append(ExtractedTransaction(
            date=parse_date(row["Kjøpsdato"]),
            title=str(row["Beskrivelse"]).strip(),
            amount=abs(float(row["Beløp"])),
            source="SB1 Credit",
            raw_data=row.to_json()
        ))
    
    return transactions


@register_extractor(
    name="sb1_common",
    description="Sparebank1 Common Account (common.csv)",
    formats=["csv"]
)
def extract_sb1_common(file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    """
    Extract transactions from Sparebank1 Common Account export.
    CSV with semicolon separator and comma decimal
    Columns: Dato, Beskrivelse, Ut
    Only processes outgoing (Ut < 0)
    """
    # Try different encodings
    for encoding in ['utf-8', 'latin-1', 'iso-8859-1']:
        try:
            df = pd.read_csv(
                io.BytesIO(file_content),
                sep=';',
                decimal=',',
                encoding=encoding
            )
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Could not decode file with any supported encoding")
    
    # Select required columns
    required_cols = ['Dato', 'Beskrivelse', 'Ut']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")
    
    df = df[required_cols]
    
    # Filter only outgoing transactions
    df = df[df['Ut'] < 0]
    
    transactions = []
    for _, row in df.iterrows():
        # Parse date with dayfirst=True for Norwegian format (DD.MM.YYYY)
        date_val = row["Dato"]
        if isinstance(date_val, str):
            try:
                date_val = pd.to_datetime(date_val, dayfirst=True).strftime("%Y-%m-%d")
            except:
                date_val = parse_date(date_val)
        else:
            date_val = parse_date(date_val)
        
        transactions.append(ExtractedTransaction(
            date=date_val,
            title=str(row["Beskrivelse"]).strip(),
            amount=abs(float(row["Ut"])),
            source="SB1 Common",
            isShared=True,
            raw_data=row.to_json()
        ))
    
    return transactions


@register_extractor(
    name="sb1_debit",
    description="Sparebank1 Debit Account (debit.csv)",
    formats=["csv"]
)
def extract_sb1_debit(file_content: bytes, filename: str) -> List[ExtractedTransaction]:
    """
    Extract transactions from Sparebank1 Debit Account export.
    CSV with semicolon separator and comma decimal
    Columns: Dato, Beskrivelse, Ut
    Only processes outgoing (Ut < 0)
    """
    # Try different encodings
    for encoding in ['utf-8', 'latin-1', 'iso-8859-1']:
        try:
            df = pd.read_csv(
                io.BytesIO(file_content),
                sep=';',
                decimal=',',
                encoding=encoding
            )
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Could not decode file with any supported encoding")
    
    # Select required columns
    required_cols = ['Dato', 'Beskrivelse', 'Ut']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Found: {list(df.columns)}")
    
    df = df[required_cols]
    
    # Filter only outgoing transactions
    df = df[df['Ut'] < 0]
    
    transactions = []
    for _, row in df.iterrows():
        # Parse date with dayfirst=True for Norwegian format (DD.MM.YYYY)
        date_val = row["Dato"]
        if isinstance(date_val, str):
            try:
                date_val = pd.to_datetime(date_val, dayfirst=True).strftime("%Y-%m-%d")
            except:
                date_val = parse_date(date_val)
        else:
            date_val = parse_date(date_val)
        
        transactions.append(ExtractedTransaction(
            date=date_val,
            title=str(row["Beskrivelse"]).strip(),
            amount=abs(float(row["Ut"])),
            source="SB1 Debit",
            raw_data=row.to_json()
        ))
    
    return transactions


