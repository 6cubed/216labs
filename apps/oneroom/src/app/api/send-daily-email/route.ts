import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import OpenAI from "openai";
import { getEmailOptInUsers } from "@/lib/db";
import { buildFashionLinks } from "@/lib/openai";

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: key });
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

function getSeason(month: number, hemisphere: "north" | "south"): string {
  const seasons =
    hemisphere === "north"
      ? ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"]
      : ["Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter", "Winter", "Winter", "Spring", "Spring", "Spring", "Summer"];
  return seasons[month];
}

const SOUTHERN_HEMISPHERE = new Set(["AU", "NZ", "ZA", "BR", "AR", "CL", "PE"]);

interface OutfitItem {
  name: string;
  category: string;
  color: string;
  material: string;
  searchQuery: string;
  links: { store: string; url: string }[];
}

interface OutfitLook {
  title: string;
  description: string;
  styleNotes: string;
  items: OutfitItem[];
}

async function generateDailyOutfits(
  userName: string,
  country: string
): Promise<OutfitLook[]> {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = new Date();
  const dayOfWeek = days[today.getDay()];
  const date = today.toISOString().split("T")[0];
  const month = today.getMonth();
  const hemisphere = SOUTHERN_HEMISPHERE.has(country) ? "south" : "north";
  const season = getSeason(month, hemisphere);

  const prompt = `You are a bold, creative personal stylist. Generate 8 completely distinct outfit looks for ${userName} today.

Today: ${date} (${dayOfWeek}) — Season: ${season}, Country: ${country}

Each look should have a completely different aesthetic/vibe. Use these 8 archetypes as loose inspiration but make each unique and surprising:
1. Casual everyday comfort
2. Smart workwear
3. Weekend brunch chic  
4. Date night
5. Active/sporty
6. Bold statement
7. Cozy home-adjacent
8. Night out

Be highly creative. Mix unexpected textures, colors, proportions. Every look must feel fresh and editorial.

For each look include 4–6 specific items. Be precise with colors, materials, silhouettes.

Respond ONLY with valid JSON (no markdown), an array of exactly 8 looks:
[
  {
    "title": "Editorial look name",
    "description": "1-sentence punchy overview",
    "styleNotes": "One key styling tip",
    "items": [
      {
        "name": "Specific item with detail",
        "category": "top|bottom|dress|outerwear|shoes|bag|accessory|jewelry|activewear",
        "color": "Specific shade",
        "material": "Primary material",
        "searchQuery": "Realistic search query"
      }
    ]
  }
]`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    temperature: 1.2,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "[]";
  const parsed: OutfitLook[] = JSON.parse(raw);

  return parsed.map((look) => ({
    ...look,
    items: look.items.map((item) => ({
      ...item,
      links: buildFashionLinks(item.searchQuery, country),
    })),
  }));
}

function buildEmailHtml(userName: string, looks: OutfitLook[], date: string): string {
  const prettyDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const CATEGORY_EMOJI: Record<string, string> = {
    top: "👕", bottom: "👖", dress: "👗", outerwear: "🧥",
    shoes: "👟", bag: "👜", accessory: "🧣", jewelry: "💍", activewear: "🏃",
  };

  const looksHtml = looks
    .map(
      (look, i) => `
    <div style="margin-bottom:32px;border-radius:16px;overflow:hidden;border:1px solid #e8e8f0;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#6c47ff,#8b5cf6);padding:20px 24px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:600;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;">Look ${i + 1} of 8</div>
        <div style="font-size:20px;font-weight:700;color:#ffffff;margin-bottom:6px;">${look.title}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);">${look.description}</div>
      </div>
      <div style="padding:20px 24px;">
        ${look.items
          .map(
            (item) => `
          <div style="padding:12px 0;border-bottom:1px solid #f0f0f8;">
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
              <span style="font-size:16px;">${CATEGORY_EMOJI[item.category] ?? "✨"}</span>
              <div>
                <div style="font-size:14px;font-weight:600;color:#1a1a2e;">${item.name}</div>
                <div style="font-size:12px;color:#888;margin-top:2px;">${item.color} · ${item.material}</div>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;padding-left:24px;">
              ${item.links
                .slice(0, 4)
                .map(
                  (link) =>
                    `<a href="${link.url}" style="display:inline-block;padding:4px 10px;background:#f4f4ff;border-radius:6px;font-size:11px;font-weight:500;color:#6c47ff;text-decoration:none;">${link.store} →</a>`
                )
                .join("")}
            </div>
          </div>`
          )
          .join("")}
        <div style="margin-top:14px;padding:12px 14px;background:#f9f9ff;border-radius:10px;border-left:3px solid #6c47ff;">
          <span style="font-size:12px;font-weight:600;color:#6c47ff;">Stylist tip: </span>
          <span style="font-size:12px;color:#555;">${look.styleNotes}</span>
        </div>
      </div>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your 8 looks for ${prettyDate}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0 24px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#6c47ff,#8b5cf6);border-radius:16px;padding:12px 20px;margin-bottom:16px;">
        <span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">One<span style="opacity:0.85;">Fit</span></span>
      </div>
      <h1 style="margin:0 0 6px;font-size:26px;font-weight:700;color:#1a1a2e;">Your 8 looks for today</h1>
      <p style="margin:0;font-size:14px;color:#888;">
        ${prettyDate} · Curated just for you, ${userName}
      </p>
    </div>

    <!-- Looks -->
    ${looksHtml}

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0 16px;border-top:1px solid #e8e8f0;margin-top:8px;">
      <p style="margin:0 0 8px;font-size:12px;color:#aaa;">
        You're receiving this because you opted in to daily outfit emails.
      </p>
      <p style="margin:0;font-size:12px;color:#aaa;">
        Visit <a href="${process.env.APP_URL ?? "https://onefit.app"}" style="color:#6c47ff;text-decoration:none;">OneFit</a> to manage your preferences.
      </p>
    </div>

  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resend = getResend();
  const fromAddress = process.env.EMAIL_FROM ?? "OneFit Daily <daily@onefit.app>";
  const date = new Date().toISOString().split("T")[0];

  const users = getEmailOptInUsers();

  if (users.length === 0) {
    return NextResponse.json({ sent: 0, message: "No opted-in users" });
  }

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const user of users) {
    try {
      const looks = await generateDailyOutfits(user.name, user.country ?? "US");
      const html = buildEmailHtml(user.name, looks, date);

      await resend.emails.send({
        from: fromAddress,
        to: user.email,
        subject: `Your 8 outfit looks for ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
        html,
      });

      results.push({ email: user.email, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to send email to ${user.email}:`, message);
      results.push({ email: user.email, success: false, error: message });
    }
  }

  const sent = results.filter((r) => r.success).length;
  return NextResponse.json({ sent, total: users.length, results });
}
