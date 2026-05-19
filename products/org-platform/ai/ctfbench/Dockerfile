FROM python:3.11-slim-bookworm

WORKDIR /app

COPY internal/python/client_error_report.py /app/client_error_report.py

COPY products/org-platform/ai/ctfbench/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY products/org-platform/ai/ctfbench/app ./app
COPY products/org-platform/ai/ctfbench/static ./static

ENV PORT=5000
ENV PYTHONUNBUFFERED=1

EXPOSE 5000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-5000}"]
