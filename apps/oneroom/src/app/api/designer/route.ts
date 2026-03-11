import { NextRequest, NextResponse } from "next/server";
import {
  analyzeAndDesign,
  generateRoomImage,
  DesignRecommendation,
} from "@/lib/openai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, goal, preferences, country, apiKey } = body as {
      image: string;
      goal: string;
      preferences?: string;
      country?: string;
      apiKey?: string;
    };

    if (!image || !goal) {
      return NextResponse.json(
        { error: "Image and room goal are required" },
        { status: 400 }
      );
    }

    const base64 = image.includes("base64,")
      ? image.split("base64,")[1]
      : image;

    const { analysis, schemes } = await analyzeAndDesign(
      base64,
      goal,
      preferences ?? "",
      country ?? "US",
      apiKey
    );

    const schemesWithImages: DesignRecommendation[] = await Promise.all(
      schemes.map(async (scheme) => {
        try {
          const imageUrl = await generateRoomImage(scheme, base64, apiKey);
          return { ...scheme, imageUrl };
        } catch {
          return scheme;
        }
      })
    );

    return NextResponse.json({ analysis, schemes: schemesWithImages });
  } catch (err) {
    console.error("Designer API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
