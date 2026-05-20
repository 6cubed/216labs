FROM python:3.11-slim

WORKDIR /app

COPY internal/python/client_error_report.py /app/client_error_report.py

COPY products/org-lifestyle/play/facerate/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY products/org-lifestyle/play/facerate/ .

RUN mkdir -p data static/faces

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV FACERATE_DB_PATH=/app/data/facerate.db
ENV FACERATE_FACES_DIR=/app/static/faces
EXPOSE 5000

CMD sh -c "python seed_faces.py & exec gunicorn -b 0.0.0.0:5000 --workers 2 app:app"
