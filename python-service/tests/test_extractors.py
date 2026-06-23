"""
Tests for bank data extractors.
Tests CSV/Excel parsing for Norwegian bank formats.

All amounts are tested in minor units (øre/cents):
  - 12.50 kr -> 1250
  - 100.00 kr -> 10000
"""

import io
from datetime import datetime

import pandas as pd
import pytest

from app.extractors.handelsbanken import (
    extract_handelsbanken_account,
    extract_handelsbanken_credit,
)
from app.extractors.norwegian_banks import (
    extract_amex_norway,
    extract_dnb_debit,
    extract_dnb_mastercard,
    extract_sb1_common,
    extract_sb1_credit,
    extract_sb1_debit,
    parse_date,
    parse_norwegian_amount,
)


class TestHelperFunctions:
    """Test helper functions for parsing"""

    def test_parse_norwegian_amount_float(self):
        """Test parsing a regular float - returns minor units (int)"""
        assert parse_norwegian_amount(123.45) == 12345  # 123.45 kr -> 12345 øre
        assert parse_norwegian_amount(-123.45) == 12345  # Returns absolute value

    def test_parse_norwegian_amount_string_comma_decimal(self):
        """Test parsing Norwegian format with comma as decimal separator"""
        assert parse_norwegian_amount("123,45") == 12345  # 123.45 kr -> 12345 øre
        assert parse_norwegian_amount("1 234,56") == 123456  # 1234.56 kr -> 123456 øre

    def test_parse_norwegian_amount_nan(self):
        """Test parsing NaN returns 0"""
        assert parse_norwegian_amount(pd.NA) == 0
        assert parse_norwegian_amount(float("nan")) == 0

    def test_parse_date_iso_format(self):
        """Test parsing ISO date format"""
        assert parse_date("2025-01-15") == "2025-01-15"

    def test_parse_date_norwegian_format(self):
        """Test parsing Norwegian date format (DD.MM.YYYY)"""
        assert parse_date("15.01.2025") == "2025-01-15"

    def test_parse_date_datetime_object(self):
        """Test parsing datetime object"""
        dt = datetime(2025, 1, 15)
        assert parse_date(dt) == "2025-01-15"


class TestDNBMastercard:
    """Test DNB MasterCard extractor"""

    def create_sample_excel(self, data: list[dict]) -> bytes:
        """Create a sample Excel file from dict data"""
        df = pd.DataFrame(data)
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer.read()

    def test_extract_basic_transactions(self):
        """Test extracting basic DNB transactions"""
        data = [
            {
                "Dato": "2025-01-15",
                "Beløpet gjelder": "Coffee Shop",
                "Valuta": "NOK",
                "Inn": None,
                "Ut": 45.00,
            },
            {
                "Dato": "2025-01-16",
                "Beløpet gjelder": "Grocery Store",
                "Valuta": "NOK",
                "Inn": None,
                "Ut": 250.50,
            },
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_dnb_mastercard(file_content, "test.xlsx")

        assert len(transactions) == 2
        assert transactions[0].title == "Coffee Shop"
        assert transactions[0].amount == 4500  # 45.00 kr -> 4500 øre
        assert transactions[0].source == "DNB Credit"
        assert transactions[0].date == "2025-01-15"

        assert transactions[1].title == "Grocery Store"
        assert transactions[1].amount == 25050  # 250.50 kr -> 25050 øre

    def test_filters_incoming_transactions(self):
        """Test that incoming transactions (refunds) are filtered out"""
        data = [
            {"Dato": "2025-01-15", "Beløpet gjelder": "Purchase", "Inn": None, "Ut": 100.00},
            {"Dato": "2025-01-16", "Beløpet gjelder": "Refund", "Inn": 50.00, "Ut": None},
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_dnb_mastercard(file_content, "test.xlsx")

        assert len(transactions) == 1
        assert transactions[0].title == "Purchase"

    def test_missing_column_raises_error(self):
        """Test that missing required column raises ValueError"""
        data = [{"Dato": "2025-01-15", "Wrong Column": "test", "Inn": None, "Ut": 100}]
        file_content = self.create_sample_excel(data)

        with pytest.raises(ValueError, match="Missing required column"):
            extract_dnb_mastercard(file_content, "test.xlsx")


class TestAmexNorway:
    """Test American Express Norway extractor"""

    def create_sample_excel_with_header(self, data: list[dict]) -> bytes:
        """Create Excel file with header at row 6 (0-indexed)"""
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            # Write empty rows first
            pd.DataFrame([[""] * 3] * 6).to_excel(writer, index=False, header=False)
            # Then write data starting at row 6
            df = pd.DataFrame(data)
            df.to_excel(writer, index=False, startrow=6)
        buffer.seek(0)
        return buffer.read()

    def test_extract_basic_transactions(self):
        """Test extracting basic Amex transactions"""
        data = [
            {
                "Dato": "2025-01-15",
                "Beskrivelse": "Restaurant ABC",
                "Kortmedlem": "John Doe",
                "Kontonummer": "1234",
                "Beløp": 450.00,
                "Utvidede detaljer": "N/A",
                "Opptrer på din kontoutskrift som": "Memes",
                "Adresse": "MemeStreet 1",
                "Postnummer": 1234,
                "Land": "Norge",
                "Referance": "ABC",
            },
            {
                "Dato": "2025-01-16",
                "Beskrivelse": "Online Store",
                "Kortmedlem": "John Doe",
                "Kontonummer": "1234",
                "Beløp": 199.90,
                "Utvidede detaljer": "N/A",
                "Opptrer på din kontoutskrift som": "Memes",
                "Adresse": "MemeStreet 1",
                "Postnummer": 1234,
                "Land": "Norge",
                "Referance": "ABC",
            },
        ]
        file_content = self.create_sample_excel_with_header(data)

        transactions = extract_amex_norway(file_content, "aktivitet.xlsx")

        assert len(transactions) == 2
        assert transactions[0].title == "Restaurant ABC"
        assert transactions[0].amount == 45000  # 450.00 kr -> 45000 øre
        assert transactions[0].source == "Amex"

        assert transactions[1].title == "Online Store"
        assert transactions[1].amount == 19990  # 199.90 kr -> 19990 øre


class TestSB1Credit:
    """Test Sparebank1 Credit Card extractor"""

    def create_sample_csv(self, rows: list[list], encoding="utf-8") -> bytes:
        """Create a sample CSV with semicolon separator"""
        header = "Kjøpsdato;Posteringsdato;Beskrivelse;Beløp"
        lines = [header] + [";".join(str(x) for x in row) for row in rows]
        content = "\n".join(lines)
        return content.encode(encoding)

    def test_extract_basic_transactions(self):
        """Test extracting basic SB1 credit transactions"""
        rows = [
            ["2025-01-15", "2025-01-16", "Coffee Shop", "-45,50"],
            ["2025-01-16", "2025-01-17", "Supermarket", "-320,00"],
        ]
        file_content = self.create_sample_csv(rows)

        transactions = extract_sb1_credit(file_content, "transactions.csv")

        assert len(transactions) == 2
        assert transactions[0].title == "Coffee Shop"
        assert transactions[0].amount == 4550  # 45.50 kr -> 4550 øre
        assert transactions[0].source == "SB1 Credit"

        assert transactions[1].title == "Supermarket"
        assert transactions[1].amount == 32000  # 320.00 kr -> 32000 øre

    def test_filters_positive_amounts(self):
        """Test that positive amounts (refunds) are filtered out"""
        rows = [
            ["2025-01-15", "2025-01-16", "Purchase", "-100,00"],
            ["2025-01-16", "2025-01-17", "Refund", "50,00"],
        ]
        file_content = self.create_sample_csv(rows)

        transactions = extract_sb1_credit(file_content, "transactions.csv")

        assert len(transactions) == 1
        assert transactions[0].title == "Purchase"

    def test_handles_latin1_encoding(self):
        """Test that Latin-1 encoded files are handled"""
        rows = [
            ["2025-01-15", "2025-01-16", "Café Nørdik", "-89,00"],
        ]
        file_content = self.create_sample_csv(rows, encoding="latin-1")

        transactions = extract_sb1_credit(file_content, "transactions.csv")

        assert len(transactions) == 1
        assert "Caf" in transactions[0].title


class TestSB1Common:
    """Test Sparebank1 Common Account extractor"""

    def create_sample_csv(self, rows: list[list]) -> bytes:
        """Create a sample CSV with semicolon separator"""
        header = "Dato;Beskrivelse;Ut"
        lines = [header] + [";".join(str(x) for x in row) for row in rows]
        content = "\n".join(lines)
        return content.encode("utf-8")

    def test_extract_basic_transactions(self):
        """Test extracting basic SB1 common account transactions"""
        rows = [
            ["15.01.2025", "Rent Payment", "-8500,00"],
            ["16.01.2025", "Utilities", "-450,00"],
        ]
        file_content = self.create_sample_csv(rows)

        transactions = extract_sb1_common(file_content, "common.csv")

        assert len(transactions) == 2
        assert transactions[0].title == "Rent Payment"
        assert transactions[0].amount == 850000  # 8500.00 kr -> 850000 øre
        assert transactions[0].source == "SB1 Common"
        assert transactions[0].isShared == True  # Common account expenses are shared

        assert transactions[1].title == "Utilities"
        assert transactions[1].amount == 45000  # 450.00 kr -> 45000 øre

    def test_parses_norwegian_date_format(self):
        """Test that Norwegian date format (DD.MM.YYYY) is parsed correctly"""
        rows = [
            ["31.12.2024", "New Year Expense", "-100,00"],
        ]
        file_content = self.create_sample_csv(rows)

        transactions = extract_sb1_common(file_content, "common.csv")

        assert transactions[0].date == "2024-12-31"

    def test_filters_incoming_transactions(self):
        """Test that incoming transactions are filtered out"""
        rows = [
            ["15.01.2025", "Expense", "-100,00"],
            ["16.01.2025", "Transfer In", "500,00"],
        ]
        file_content = self.create_sample_csv(rows)

        transactions = extract_sb1_common(file_content, "common.csv")

        assert len(transactions) == 1
        assert transactions[0].title == "Expense"


class TestSB1Debit:
    """Test Sparebank1 Debit Account extractor"""

    def create_sample_csv(self, rows: list[list]) -> bytes:
        """Create a sample CSV with semicolon separator"""
        header = "Dato;Posteringsdato;Beskrivelse;Ut"
        lines = [header] + [";".join(str(x) for x in row) for row in rows]
        content = "\n".join(lines)
        return content.encode("utf-8")

    def test_extract_basic_transactions(self):
        """Test extracting basic SB1 debit transactions"""
        rows = [
            ["15.01.2025", "16.01.2025", "ATM Withdrawal", "-500,00"],
            ["16.01.2025", "17.01.2025", "Card Payment", "-125,50"],
        ]
        file_content = self.create_sample_csv(rows)

        transactions = extract_sb1_debit(file_content, "debit.csv")

        assert len(transactions) == 2
        assert transactions[0].title == "ATM Withdrawal"
        assert transactions[0].amount == 50000  # 500.00 kr -> 50000 øre
        assert transactions[0].source == "SB1 Debit"
        assert transactions[0].isShared == False  # Debit is not shared by default

        assert transactions[1].title == "Card Payment"
        assert transactions[1].amount == 12550  # 125.50 kr -> 12550 øre


class TestExportCSVFormat:
    """Test that exported transactions can be imported back"""

    def test_round_trip_data_integrity(self):
        """Test that data maintains integrity through extract cycle"""
        # Create sample SB1 debit data
        rows = [
            ["15.01.2025", "16.01.2025", "Test Transaction", "-999,99"],
        ]
        header = "Dato;PosteringsDato;Beskrivelse;Ut"
        lines = [header] + [";".join(str(x) for x in row) for row in rows]
        content = "\n".join(lines).encode("utf-8")

        # Extract
        transactions = extract_sb1_debit(content, "debit.csv")

        # Verify data integrity
        assert len(transactions) == 1
        t = transactions[0]
        assert t.date == "2025-01-15"
        assert t.title == "Test Transaction"
        assert t.amount == 99999  # 999.99 kr -> 99999 øre
        assert t.source == "SB1 Debit"


class TestHandelsbankenCredit:
    """Test Handelsbanken Credit Card extractor"""

    def create_sample_excel(self, data: list[dict]) -> bytes:
        """Create a sample Excel file from dict data"""
        df = pd.DataFrame(data)
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer.read()

    def test_extract_basic_transactions(self):
        """Test extracting basic Handelsbanken credit transactions"""
        data = [
            {
                "Dato": "11.06.2026",
                "Beskrivelse": "BOLT.EU/O/2606102152",
                "Inn på konto": None,
                "Ut fra konto": -30.00,
                "Originalt beløp": -30,
                "Valuta": "NOK",
                "Kurs": "-",
            },
            {
                "Dato": "10.06.2026",
                "Beskrivelse": "EasyPark AS easypark.no",
                "Inn på konto": None,
                "Ut fra konto": -21.90,
                "Originalt beløp": -21.90,
                "Valuta": "NOK",
                "Kurs": "-",
            },
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_handelsbanken_credit(file_content, "transaksjoner.xlsx")

        assert len(transactions) == 2
        # Sorted by date in the extractor's caller, but extract_* preserves file order
        assert transactions[0].title == "BOLT.EU/O/2606102152"
        assert transactions[0].amount == 3000  # 30.00 kr -> 3000 øre
        assert transactions[0].source == "Handelsbanken Credit"
        assert transactions[0].date == "2026-06-11"

        assert transactions[1].title == "EasyPark AS easypark.no"
        assert transactions[1].amount == 2190  # 21.90 kr -> 2190 øre

    def test_filters_incoming_transactions(self):
        """Test that incoming transactions (refunds) are filtered out"""
        data = [
            {
                "Dato": "11.06.2026",
                "Beskrivelse": "Purchase",
                "Inn på konto": None,
                "Ut fra konto": -100.00,
            },
            {
                "Dato": "12.06.2026",
                "Beskrivelse": "Refund",
                "Inn på konto": 50.00,
                "Ut fra konto": None,
            },
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_handelsbanken_credit(file_content, "transaksjoner.xlsx")

        assert len(transactions) == 1
        assert transactions[0].title == "Purchase"

    def test_missing_column_raises_error(self):
        """Test that missing required column raises ValueError"""
        data = [{"Dato": "11.06.2026", "Wrong Column": "test", "Ut fra konto": -100}]
        file_content = self.create_sample_excel(data)

        with pytest.raises(ValueError, match="Missing required column"):
            extract_handelsbanken_credit(file_content, "transaksjoner.xlsx")


class TestHandelsbankenAccount:
    """Test Handelsbanken Account extractor"""

    def create_sample_excel(self, data: list[dict]) -> bytes:
        """Create a sample Excel file from dict data"""
        df = pd.DataFrame(data)
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer.read()

    def test_extract_basic_transactions(self):
        """Test extracting basic Handelsbanken account transactions"""
        data = [
            {
                "Utført dato": "12.06.2026",
                "Beskrivelse": "Dominos",
                "Type": "Varekjøp",
                "Beløp inn": None,
                "Beløp ut": -462.00,
                "Valuta": "NOK",
                "Status": "Bokført",
            },
            {
                "Utført dato": "11.06.2026",
                "Beskrivelse": "Vipps*FLYTOGET AS",
                "Type": "Varekjøp",
                "Beløp inn": None,
                "Beløp ut": -268.00,
                "Valuta": "NOK",
                "Status": "Bokført",
            },
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_handelsbanken_account(file_content, "Transaksjoner.xlsx")

        assert len(transactions) == 2
        assert transactions[0].title == "Dominos"
        assert transactions[0].amount == 46200  # 462.00 kr -> 46200 øre
        assert transactions[0].source == "Handelsbanken Account"
        assert transactions[0].date == "2026-06-12"

        assert transactions[1].title == "Vipps*FLYTOGET AS"
        assert transactions[1].amount == 26800  # 268.00 kr -> 26800 øre

    def test_filters_reserved_transactions(self):
        """Test that pending ('Reservert') transactions are filtered out"""
        data = [
            {
                "Utført dato": "12.06.2026",
                "Beskrivelse": "Pending Purchase",
                "Beløp inn": None,
                "Beløp ut": -100.00,
                "Status": "Reservert",
            },
            {
                "Utført dato": "11.06.2026",
                "Beskrivelse": "Booked Purchase",
                "Beløp inn": None,
                "Beløp ut": -200.00,
                "Status": "Bokført",
            },
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_handelsbanken_account(file_content, "Transaksjoner.xlsx")

        assert len(transactions) == 1
        assert transactions[0].title == "Booked Purchase"

    def test_filters_incoming_transactions(self):
        """Test that incoming transactions (salary, refunds) are filtered out"""
        data = [
            {
                "Utført dato": "12.06.2026",
                "Beskrivelse": "Lønn",
                "Beløp inn": 10549.10,
                "Beløp ut": None,
            },
            {
                "Utført dato": "12.06.2026",
                "Beskrivelse": "Dominos",
                "Beløp inn": None,
                "Beløp ut": -462.00,
            },
        ]
        file_content = self.create_sample_excel(data)

        transactions = extract_handelsbanken_account(file_content, "Transaksjoner.xlsx")

        assert len(transactions) == 1
        assert transactions[0].title == "Dominos"

    def test_missing_column_raises_error(self):
        """Test that missing required column raises ValueError"""
        data = [{"Utført dato": "12.06.2026", "Wrong Column": "test", "Beløp ut": -100}]
        file_content = self.create_sample_excel(data)

        with pytest.raises(ValueError, match="Missing required column"):
            extract_handelsbanken_account(file_content, "Transaksjoner.xlsx")


class TestDNBDebit:
    """Test DNB Debit Account extractor"""

    def create_sample_excel(self, data: list[dict]) -> bytes:
        df = pd.DataFrame(data)
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer.read()

    def test_extract_filters_incoming_and_reserved(self):
        """Outgoing booked rows kept; incoming and 'Reservert' rows dropped"""
        data = [
            {
                "Dato": "2026-06-22",
                "Forklaring": "AvtaleGiro  Reservert transaksjon",
                "Ut fra konto": 1391,
                "Inn på konto": None,
            },
            {
                "Dato": "2026-06-11",
                "Forklaring": "Salary",
                "Ut fra konto": None,
                "Inn på konto": 1000,
            },
            {
                "Dato": "2026-05-21",
                "Forklaring": "Gjensidige Forsikring",
                "Ut fra konto": 1395.50,
                "Inn på konto": None,
            },
        ]
        transactions = extract_dnb_debit(self.create_sample_excel(data), "dnb.xlsx")

        assert len(transactions) == 1
        assert transactions[0].title == "Gjensidige Forsikring"
        assert transactions[0].amount == 139550  # 1395.50 kr -> 139550 øre
        assert transactions[0].source == "DNB Debit"
        assert transactions[0].date == "2026-05-21"

    def test_missing_column_raises_error(self):
        data = [{"Dato": "2026-05-21", "Wrong Column": "x", "Ut fra konto": 100}]
        with pytest.raises(ValueError, match="Missing required column"):
            extract_dnb_debit(self.create_sample_excel(data), "dnb.xlsx")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
