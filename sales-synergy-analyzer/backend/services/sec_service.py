import httpx
import re
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup

SEC_HEADERS = {
    "User-Agent": "StockAnalyzer rafael@email.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "data.sec.gov",
}

EDGAR_HEADERS = {
    "User-Agent": "StockAnalyzer rafael@email.com",
    "Accept-Encoding": "gzip, deflate",
}

TIMEOUT = 15.0


async def get_cik(ticker: str) -> Optional[str]:
    url = f"https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&forms=8-K"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=EDGAR_HEADERS)
            if resp.status_code == 200:
                data = resp.json()
                hits = data.get("hits", {}).get("hits", [])
                if hits:
                    entity_id = hits[0].get("_source", {}).get("entity_id")
                    if entity_id:
                        return str(entity_id).zfill(10)
    except Exception:
        pass

    # Fallback: company search
    url2 = f"https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK={ticker}&type=8-K&action=getcompany&output=atom"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url2, headers=EDGAR_HEADERS)
            if resp.status_code == 200:
                match = re.search(r"CIK=(\d+)", resp.text)
                if match:
                    return match.group(1).zfill(10)
    except Exception:
        pass

    return None


async def get_latest_8k(cik: str) -> Optional[Dict[str, Any]]:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=SEC_HEADERS)
            if resp.status_code != 200:
                return None

            data = resp.json()
            filings = data.get("filings", {}).get("recent", {})
            forms = filings.get("form", [])
            accession_nos = filings.get("accessionNumber", [])
            primary_docs = filings.get("primaryDocument", [])
            filing_dates = filings.get("filingDate", [])

            for i, form in enumerate(forms):
                if form == "8-K":
                    acc_no = accession_nos[i].replace("-", "")
                    primary_doc = primary_docs[i]
                    filing_date = filing_dates[i]
                    return {
                        "cik": cik,
                        "accession_no": acc_no,
                        "primary_doc": primary_doc,
                        "filing_date": filing_date,
                    }
    except Exception:
        pass

    return None


async def fetch_document_text(cik: str, accession_no: str, primary_doc: str) -> Optional[str]:
    cik_int = int(cik)
    url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession_no}/{primary_doc}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url, headers=EDGAR_HEADERS)
            if resp.status_code != 200:
                return None

            content_type = resp.headers.get("content-type", "")
            if "html" in content_type or primary_doc.endswith(".htm") or primary_doc.endswith(".html"):
                soup = BeautifulSoup(resp.text, "lxml")
                for tag in soup(["script", "style"]):
                    tag.decompose()
                text = soup.get_text(separator="\n")
            else:
                text = resp.text

            # Clean whitespace
            lines = [line.strip() for line in text.splitlines()]
            cleaned = "\n".join(line for line in lines if line)
            return cleaned[:15000]  # limit for Claude context
    except Exception:
        return None


async def get_earnings_release(ticker: str) -> Dict[str, Any]:
    result = {"sec_available": False, "filing_date": None, "text": None}

    try:
        cik = await get_cik(ticker)
        if not cik:
            return result

        filing = await get_latest_8k(cik)
        if not filing:
            return result

        text = await fetch_document_text(
            filing["cik"],
            filing["accession_no"],
            filing["primary_doc"]
        )
        if not text:
            return result

        result["sec_available"] = True
        result["filing_date"] = filing["filing_date"]
        result["text"] = text

    except Exception:
        pass

    return result
