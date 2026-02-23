FROM python:3.11-slim

WORKDIR /app

COPY gae_app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY gae_app/ .

ENV FLASK_APP=main.py
EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "main:app"]
