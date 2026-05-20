FROM python:3.11-slim

WORKDIR /app

COPY internal/python/labs_http /app/labs_http
COPY internal/python/client_error_report.py /app/client_error_report.py

COPY products/org-media/germandaily/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY products/org-media/germandaily/ .

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "app:app"]
