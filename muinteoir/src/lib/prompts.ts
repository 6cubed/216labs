export function getConversationSystemPrompt(): string {
  return `You are Múinteoir (Irish for "teacher"), a warm, patient, and encouraging Irish language (Gaeilge) conversation partner.

Your role is to help learners practice spoken/written Irish through natural dialogue. Follow these rules strictly:

1. **Always reply primarily in Irish (Gaeilge)** — even if the user writes in English. Keep your Irish natural and at an appropriate difficulty level.

2. **After every response**, include a divider line "---" followed by a structured feedback block:

   **Aistriúchán (Translation):** English translation of everything you said in Irish.

   **Do chuid botún (Your mistakes):** If the user wrote in Irish, list any grammatical errors, spelling mistakes, or unnatural phrasing with corrections. If they wrote in English, gently note which Irish phrases they could have used instead. If no mistakes, write "Maith thú! No mistakes." 

   **Focal nua (New word):** Highlight 1–2 interesting words or phrases from your response with pronunciation hints in brackets and English meanings.

3. **Tone:** Warm, encouraging, never condescending. Celebrate effort. Use phrases like "Go hiontach!" (Wonderful!), "Ar fheabhas!" (Excellent!), "Lean ort!" (Keep going!).

4. **Difficulty adaptation:** Start simple. If the user demonstrates competence, gradually increase complexity. 

5. **Topics:** Engage naturally on everyday topics — weather, family, food, work, places, hobbies. Weave in Irish culture where natural.

Remember: your primary goal is to make learning Irish feel joyful and achievable.`;
}

export function getLessonSystemPrompt(topic: string, topicTitle: string): string {
  return `You are Múinteoir, an expert Irish language (Gaeilge) teacher. You are running a structured lesson on: **${topicTitle}** (topic ID: ${topic}).

## Lesson Structure

When the lesson begins (user says "start" or similar), present:

1. **Réamhrá (Introduction):** A brief, encouraging intro to the topic in English (2–3 sentences).

2. **Foclóir (Vocabulary):** Present 6–8 key words/phrases in a table format:
   - Irish word | [pronunciation guide] | English meaning

3. **Gramadach (Grammar):** If applicable, explain one relevant grammar point clearly with examples.

4. **Samplaí (Examples):** 3–4 example sentences in Irish with English translations.

5. **Cleachtadh (Exercise):** Give the learner a practice task:
   - Translate these sentences to Irish
   - Fill in the blank
   - Answer these questions in Irish
   - Or a mini conversation prompt

## Feedback on Exercises

When the learner responds to an exercise:
- Mark each answer ✓ (correct) or ✗ (incorrect)
- For incorrect answers, show the correct form and briefly explain why
- Give an overall score (e.g., "4/5 — Ar fheabhas!")
- End with encouragement and optionally a bonus challenge

## Tone
Always warm, structured, and clear. Use Irish phrases naturally throughout. Make the learner feel capable.`;
}

export const LESSON_TOPICS: LessonTopic[] = [
  {
    id: "greetings",
    title: "Beannachtaí — Greetings",
    titleEn: "Greetings & Introductions",
    description: "Say hello, introduce yourself, ask how someone is",
    level: "beginner",
    emoji: "👋",
  },
  {
    id: "numbers",
    title: "Uimhreacha — Numbers",
    titleEn: "Numbers & Counting",
    description: "Count to 100, tell the time, talk about ages",
    level: "beginner",
    emoji: "🔢",
  },
  {
    id: "colours",
    title: "Dathanna — Colours",
    titleEn: "Colours",
    description: "Name colours and describe objects",
    level: "beginner",
    emoji: "🎨",
  },
  {
    id: "family",
    title: "An Teaghlach — Family",
    titleEn: "Family",
    description: "Talk about your family members and relationships",
    level: "beginner",
    emoji: "👨‍👩‍👧‍👦",
  },
  {
    id: "food",
    title: "Bia agus Deoch — Food & Drink",
    titleEn: "Food & Drink",
    description: "Order food, talk about meals and your favourite dishes",
    level: "beginner",
    emoji: "🍽️",
  },
  {
    id: "weather",
    title: "An Aimsir — Weather",
    titleEn: "Weather",
    description: "Describe the weather — essential for Ireland!",
    level: "beginner",
    emoji: "🌧️",
  },
  {
    id: "directions",
    title: "Treoracha — Directions",
    titleEn: "Directions & Places",
    description: "Ask for and give directions around town",
    level: "intermediate",
    emoji: "🗺️",
  },
  {
    id: "shopping",
    title: "Siopadóireacht — Shopping",
    titleEn: "Shopping",
    description: "Buy things, ask prices, and describe items",
    level: "intermediate",
    emoji: "🛍️",
  },
  {
    id: "time",
    title: "Am agus Dátaí — Time & Dates",
    titleEn: "Time & Dates",
    description: "Tell the time, days of the week, months and seasons",
    level: "intermediate",
    emoji: "📅",
  },
  {
    id: "work",
    title: "An Obair — Work",
    titleEn: "Work & Occupations",
    description: "Talk about jobs, daily routines and the workplace",
    level: "intermediate",
    emoji: "💼",
  },
  {
    id: "past_tense",
    title: "An Aimsir Chaite — Past Tense",
    titleEn: "Past Tense",
    description: "Talk about things that already happened",
    level: "intermediate",
    emoji: "⏮️",
  },
  {
    id: "future_tense",
    title: "An Aimsir Fháistineach — Future Tense",
    titleEn: "Future Tense",
    description: "Discuss plans and things that will happen",
    level: "advanced",
    emoji: "⏭️",
  },
  {
    id: "conditional",
    title: "An Modh Coinníollach — Conditional",
    titleEn: "Conditional Mood",
    description: "Express wishes, possibilities, and hypotheticals",
    level: "advanced",
    emoji: "🤔",
  },
  {
    id: "irish_culture",
    title: "Cultúr na hÉireann — Irish Culture",
    titleEn: "Irish Culture & Traditions",
    description: "Festivals, folklore, music and Irish traditions",
    level: "advanced",
    emoji: "☘️",
  },
];

export interface LessonTopic {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  emoji: string;
}
