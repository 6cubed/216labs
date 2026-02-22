# Paperframe

Segment and caption any image or video. Upload a photo or video clip, and Paperframe runs **Segment Anything (SAM)** to detect every object, then **BLIP** to auto-caption each segment — all displayed as an interactive overlay.

## Architecture

| Component | Stack |
|-----------|-------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS |
| **Backend** | FastAPI, SAM (ViT-B), BLIP (Salesforce) |
| **Infra** | Docker Compose |

## Quick start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/health

> On first run the backend downloads the SAM checkpoint (~375 MB) and BLIP weights (~990 MB). These are cached in Docker volumes.

### Without GPU

The `docker-compose.yml` includes a GPU reservation. On CPU-only machines, remove the `deploy.resources` block from the `backend` service, or run:

```bash
docker compose up --build backend frontend
```

The backend will fall back to CPU automatically (slower inference).

### Local development

**Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## How it works

1. **Upload** — the frontend sends the file to `POST /api/process`
2. **Frame extraction** — videos are sampled at 1 fps via OpenCV
3. **Segmentation** — SAM's automatic mask generator finds all objects
4. **Captioning** — each segment's bounding-box crop is captioned by BLIP
5. **Display** — masks are RLE-encoded and rendered as coloured overlays on a canvas with interactive hover/click and a sidebar segment list
