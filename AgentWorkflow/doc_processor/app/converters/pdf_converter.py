# services/doc-processor/app/converters/pdf_converter.py
# Converts a PDF file into one PNG image per page using pdf2image (poppler).

import os
from pathlib import Path
from typing import List

from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError


def convert_pdf_to_images(
    pdf_path: str,
    output_dir: str,
    dpi: int = 150,
    image_format: str = "PNG",
) -> List[str]:
    """
    Convert each page of a PDF into a PNG image.

    Args:
        pdf_path:     Path to the source PDF file
        output_dir:   Directory to save output PNG images
        dpi:          Resolution (150 dpi = good quality, fast; 200+ = higher quality)
        image_format: Output format (PNG recommended for Agent 1 vision)

    Returns:
        List of absolute paths to generated images, ordered by page number
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        pages = convert_from_path(
            pdf_path,
            dpi=dpi,
            fmt=image_format.lower(),
            thread_count=4,
            use_pdftocairo=True,  # better quality than pdftoppm
        )
    except PDFInfoNotInstalledError:
        raise RuntimeError(
            "poppler is not installed. "
            "Install with: apt-get install poppler-utils (Linux) or brew install poppler (macOS)"
        )
    except PDFPageCountError as e:
        raise RuntimeError(f"Could not read PDF: {e}")

    image_paths = []
    for i, page in enumerate(pages):
        filename = f"slide_{i + 1:03d}.png"
        filepath = output_path / filename
        page.save(str(filepath), image_format)
        image_paths.append(str(filepath))

    return image_paths
