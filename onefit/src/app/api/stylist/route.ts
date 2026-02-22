import { NextRequest, NextResponse } from "next/server";
import {
  analyzeAndRecommend,
  generateOutfitImage,
  OutfitRecommendation,
} from "@/lib/openai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, occasion, preferences, apiKey } = body as {
      image: string;
      occasion: string;
      preferences?: string;
      apiKey?: string;
    };

    if (!image || !occasion) {
      return NextResponse.json(
        { error: "Image and occasion are required" },
        { status: 400 }
      );
    }

    const base64 = image.includes("base64,")
      ? image.split("base64,")[1]
      : image;

    const { analysis, outfits } = await analyzeAndRecommend(
      base64,
      occasion,
      preferences ?? "",
      apiKey
    );

    const outfitsWithImages: OutfitRecommendation[] = await Promise.all(
      outfits.map(async (outfit) => {
        try {
          const imageUrl = await generateOutfitImage(outfit, base64, apiKey);
          return { ...outfit, imageUrl };
        } catch {
          return outfit;
        }
      })
    );

    return NextResponse.json({ analysis, outfits: outfitsWithImages });
  } catch (err) {
    console.error("Stylist API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
