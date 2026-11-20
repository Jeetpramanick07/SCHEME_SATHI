FROM python:3.10-slim

WORKDIR /app

# Install system dependencies: ffmpeg, libsndfile1, curl, git
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /home/appuser/.cache && \
    chown -R appuser:appuser /home/appuser /app

# Copy requirements first for Docker layer caching
COPY --chown=appuser:appuser requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY --chown=appuser:appuser server.py .

USER appuser

EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0
ENV MOCK_VOICE=false
ENV HF_HOME=/home/appuser/.cache/huggingface

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
