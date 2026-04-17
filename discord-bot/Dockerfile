FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY bot.py .
COPY database.py .
COPY scheduler.py .
COPY commands/ ./commands/

# Create uploads dir
RUN mkdir -p uploads

# Run bot
CMD ["python", "bot.py"]
