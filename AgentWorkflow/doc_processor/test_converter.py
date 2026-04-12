# services/doc-processor/test_converter.py
# Quick local test — run BEFORE Docker to verify converters work.
# Usage: python test_converter.py path/to/your/test.pdf
#        python test_converter.py path/to/your/test.pptx

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

def test_pdf(pdf_path: str):
    from app.converters.pdf_converter import convert_pdf_to_images

    print(f"🔄 Converting PDF: {pdf_path}")
    output_dir = "/tmp/lecturelife/test_pdf"
    os.makedirs(output_dir, exist_ok=True)

    images = convert_pdf_to_images(pdf_path, output_dir, dpi=150)
    print(f"✅ Generated {len(images)} images:")
    for img in images:
        size = os.path.getsize(img) / 1024
        print(f"   {img} ({size:.0f} KB)")


def test_pptx(pptx_path: str):
    from app.converters.pptx_converter import convert_pptx_to_images

    print(f"🔄 Converting PPTX: {pptx_path}")
    output_dir = "/tmp/lecturelife/test_pptx"
    os.makedirs(output_dir, exist_ok=True)

    images = convert_pptx_to_images(pptx_path, output_dir)
    print(f"✅ Generated {len(images)} images:")
    for img in images:
        size = os.path.getsize(img) / 1024
        print(f"   {img} ({size:.0f} KB)")


def test_marker(pdf_path: str):
    from app.converters.marker_converter import extract_text_with_marker

    print(f"🔄 Extracting text with Marker: {pdf_path}")
    text = extract_text_with_marker(pdf_path)
    print(f"✅ Extracted {len(text)} characters")
    print(f"Preview:\n{text[:500]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_converter.py <path-to-pdf-or-pptx>")
        sys.exit(1)

    file_path = sys.argv[1]
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        test_pdf(file_path)
        test_marker(file_path)
    elif ext in (".pptx", ".ppt"):
        test_pptx(file_path)
    else:
        print(f"Unsupported file type: {ext}")
        sys.exit(1)
