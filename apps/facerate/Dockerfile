FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data static/faces

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV FACERATE_DB_PATH=/app/data/facerate.db
ENV FACERATE_FACES_DIR=/app/static/faces
EXPOSE 5000

# Seed faces in background, then start server. Run classify_faces.py separately for gender/age filtering.
CMD sh -c "python seed_faces.py & exec gunicorn -b 0.0.0.0:5000 --workers 2 app:app"
