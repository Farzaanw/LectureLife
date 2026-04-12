# services/doc-processor/app/converters/marker_converter.py
# Extracts text from a PDF as markdown using the Marker library.
# This is the fallback used when Claude Vision fails for a slide (Milestone 4.5).

import os
from pathlib import Path


def extract_text_with_marker(pdf_path: str) -> str:
    """
    Extract text from a PDF as markdown using Marker.

    Marker is a high-quality PDF text extractor that preserves structure
    better than raw pdfminer/PyPDF2. Used as fallback when Vision fails.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Extracted text as markdown string
    """
    try:
        from marker.convert import convert_single_pdf
        from marker.models import load_all_models

        models = load_all_models()
        full_text, _, _ = convert_single_pdf(pdf_path, models)
        return full_text

    except ImportError:
        # Marker not installed — fall back to pdfminer
        return _extract_with_pdfminer(pdf_path)
    except Exception as e:
        # Any other error — fall back to pdfminer
        print(f"[Marker] Failed, falling back to pdfminer: {e}")
        return _extract_with_pdfminer(pdf_path)


def _extract_with_pdfminer(pdf_path: str) -> str:
    """
    Lightweight fallback using pdfminer.six for basic text extraction.
    No layout preservation, but always available.
    """
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(pdf_path)
        return text or ""
    except ImportError:
        raise RuntimeError(
            "Neither marker nor pdfminer.six is installed. "
            "Install with: pip install pdfminer.six"
        )
    except Exception as e:
        raise RuntimeError(f"Text extraction failed: {e}")
