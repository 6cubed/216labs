# OneFit — AI Personal Stylist

Upload your photo, describe the occasion, and OneFit's AI stylist crafts 4 complete outfits with generated visuals and shoppable product links.

## How it works

1. **Upload** a photo of yourself
2. **Describe** the event or occasion (e.g. "summer wedding in Tuscany")
3. **Optionally** add style preferences (colours, vibes, brands)
4. **GPT-4o Vision** analyses your photo and generates 4 tailored outfit recommendations
5. **DALL-E 3** generates fashion visuals for each outfit
6. Each item comes with **clickable shop links** to Google Shopping, Amazon, ASOS, and Nordstrom

## Setup

```bash
cp .env.example .env
# Add your OpenAI API key to .env

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech stack

- **Next.js 14** (App Router)
- **Tailwind CSS** + Framer Motion
- **OpenAI GPT-4o** (vision analysis + outfit recommendation)
- **OpenAI DALL-E 3** (outfit image generation)

## Requirements

- Node.js 18+
- OpenAI API key with access to GPT-4o and DALL-E 3
