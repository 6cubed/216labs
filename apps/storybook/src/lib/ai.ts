import OpenAI from "openai";

function getClient(): OpenAI {
  const key = process.env.STORYBOOK_OPENAI_API_KEY;
  if (!key) throw new Error("STORYBOOK_OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

export interface GeneratedPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

export interface GeneratedStory {
  title: string;
  subtitle: string;
  characterDescription: string;
  pages: GeneratedPage[];
}

const STORY_SYSTEM_PROMPT = `You are a beloved children's book author who creates magical, age-appropriate stories with vivid imagery.

You will receive: a child's age, a topic or idea, and optionally the child's name.

Your task is to create a complete children's storybook:
- A catchy, memorable title
- A short subtitle (e.g. "A story about courage and kindness")
- A brief character description (for consistent illustration style)
- Exactly 6 story pages, each with:
  - Age-appropriate text (2-3 short sentences for ages 2-5, 3-4 sentences for ages 6-12)
  - A detailed illustration prompt for DALL-E 3

Guidelines:
- Make the story wholesome, imaginative, and uplifting
- Include a simple moral lesson woven naturally into the story
- Each page should advance the story clearly
- The illustration prompts should be vivid, specify the character consistently, and describe the exact scene

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "title": "Story title",
  "subtitle": "A story about ...",
  "characterDescription": "Brief visual description of the main character for consistent illustration",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Story text for this page...",
      "imagePrompt": "Detailed scene description for illustration..."
    }
  ]
}`;

export async function generateStory(
  age: number,
  topic: string,
  childName: string
): Promise<GeneratedStory> {
  const userPrompt = [
    `Age: ${age} years old`,
    `Topic / Idea: ${topic}`,
    childName ? `Main character's name: ${childName}` : "Choose an appropriate character name",
  ].join("\n");

  const response = await getClient().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.9,
    max_tokens: 4000,
    messages: [
      { role: "system", content: STORY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as GeneratedStory;

  if (!parsed.pages || parsed.pages.length === 0) {
    throw new Error("Story generation returned no pages");
  }

  return parsed;
}

export async function generatePageImage(
  imagePrompt: string,
  characterDescription: string,
  age: number
): Promise<string> {
  const fullPrompt = [
    `Children's book illustration, vibrant watercolor style, soft and whimsical, warm and inviting colors.`,
    `Character: ${characterDescription}.`,
    `Scene: ${imagePrompt}`,
    `Style: Full-page spread, suitable for ages ${age}, no text or words in the image, professional children's book quality.`,
  ].join(" ");

  const response = await getClient().images.generate({
    model: "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    style: "vivid",
    response_format: "url",
  });

  return response.data?.[0]?.url ?? "";
}
