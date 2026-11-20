#!/bin/bash
set -e

echo "=== Setting up Indic Voice Service (AI4Bharat STT & TTS) ==="

# Check Python version
python3 --version

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Upgrading pip and installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Setup completed successfully!"
echo "Run server with: uvicorn server:app --host 0.0.0.0 --port 8000"
