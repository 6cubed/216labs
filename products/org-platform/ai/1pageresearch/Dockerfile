FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV ONEPAGE_DB_PATH=/app/data/1pageresearch.db
EXPOSE 5000

# Seed DB then start; seed is idempotent (INSERT OR REPLACE by slug)
CMD sh -c "python seed.py && gunicorn -b 0.0.0.0:5000 --workers 2 --timeout 120 app:app"
