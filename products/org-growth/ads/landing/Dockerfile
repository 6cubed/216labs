FROM python:3.11-slim

WORKDIR /app

# Shared stdlib HTTP helpers (repo-root build context)
COPY internal/python/labs_http /app/labs_http

COPY products/org-growth/ads/landing/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY products/org-growth/ads/landing/ .

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "--workers", "1", "app:app"]
