import { NextRequest, NextResponse } from "next/server";
import { insertParticipant } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      age,
      gender,
      interested_in,
      occupation,
      neighborhood,
      bio,
      three_things,
      perfect_date,
      email,
    } = body;

    if (
      !name ||
      !age ||
      !gender ||
      !interested_in ||
      !bio ||
      !three_things ||
      !perfect_date ||
      !email
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (typeof age !== "number" || age < 18 || age > 99) {
      return NextResponse.json(
        { error: "Invalid age. Must be between 18 and 99." },
        { status: 400 }
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    const participant = insertParticipant({
      name: String(name).trim().slice(0, 100),
      age,
      gender: String(gender).trim(),
      interested_in: String(interested_in).trim(),
      occupation: occupation ? String(occupation).trim().slice(0, 200) : null,
      neighborhood: neighborhood
        ? String(neighborhood).trim().slice(0, 100)
        : null,
      bio: String(bio).trim().slice(0, 500),
      three_things: String(three_things).trim().slice(0, 300),
      perfect_date: String(perfect_date).trim().slice(0, 300),
      email: String(email).trim().toLowerCase(),
    });

    return NextResponse.json(
      { success: true, id: participant.id },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";

    if (message.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "This email is already registered. Only one entry per person!" },
        { status: 409 }
      );
    }

    console.error("[signup] Error:", message);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
