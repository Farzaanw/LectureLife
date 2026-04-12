# services/doc-processor/Dockerfile

FROM python:3.11-slim

# Install system dependencies
# poppler-utils: required by pdf2image for PDF → PNG conversion
# libreoffice: required for PPTX → PDF conversion
# fonts: required for PPTX fallback renderer
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libreoffice \
    libreoffice-impress \
    fonts-dejavu-core \
    fonts-liberation \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY app/ ./app/

# Create output directory
RUN mkdir -p /tmp/lecturelife/slides

# Environment defaults
ENV OUTPUT_DIR=/tmp/lecturelife/slides
ENV MAX_FILE_SIZE_MB=50
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
