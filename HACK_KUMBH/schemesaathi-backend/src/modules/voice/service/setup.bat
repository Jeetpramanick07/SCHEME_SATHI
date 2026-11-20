@echo off
echo === Setting up Indic Voice Service (AI4Bharat STT & TTS) ===

python --version
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Upgrading pip and installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo Setup completed successfully!
echo Run server with: uvicorn server:app --host 0.0.0.0 --port 8000
pause
