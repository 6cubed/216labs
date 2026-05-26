FROM python:3.11-slim

WORKDIR /app

COPY internal/python/client_error_report.py /app/client_error_report.py
COPY internal/python/admin_session.py /app/admin_session.py
COPY internal/python/agitweet_post.py /app/agitweet_post.py

COPY internal/admin/difftinder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY internal/admin/difftinder/ .

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "app:app"]
