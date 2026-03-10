import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LessonCard from "@/components/LessonCard";
import ProgressBar from "@/components/ProgressBar";
import { LESSON_TOPICS, LessonTopic } from "@/lib/prompts";
import { getAllProgress } from "@/lib/db";

interface TopicWithProgress extends LessonTopic {
  progress: {
    topic_id: string;
    completed_at: number | null;
    score: number;
    attempts: number;
  } | null;
}

export const dynamic = "force-dynamic";

export default function LessonsPage() {
  const progress = getAllProgress();
  const progressMap = Object.fromEntries(progress.map((p) => [p.topic_id, p]));

  const topics: TopicWithProgress[] = LESSON_TOPICS.map((t) => ({
    ...t,
    progress: progressMap[t.id] ?? null,
  }));

  const completed = progress.filter((p) => p.completed_at !== null).length;

  const beginnerTopics = topics.filter((t) => t.level === "beginner");
  const intermediateTopics = topics.filter((t) => t.level === "intermediate");
  const advancedTopics = topics.filter((t) => t.level === "advanced");

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 py-6">
      {/* Back + title */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-700 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Baile
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl text-surface-900">
              Ceachtanna
            </h1>
            <p className="text-surface-500 mt-1">
              Structured Irish lessons — pick a topic and start learning
            </p>
          </div>
          <div className="sm:w-56">
            <ProgressBar completed={completed} total={LESSON_TOPICS.length} />
          </div>
        </div>
      </div>

      {/* Beginner */}
      <Section title="Tosaitheoir — Beginner" topics={beginnerTopics} />
      <Section title="Meánleibhéal — Intermediate" topics={intermediateTopics} />
      <Section title="Ardleibhéal — Advanced" topics={advancedTopics} />
    </main>
  );
}

function Section({ title, topics }: { title: string; topics: TopicWithProgress[] }) {
  if (topics.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="font-display font-bold text-lg text-surface-700 mb-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-surface-200" />
        {title}
        <span className="h-px flex-1 bg-surface-200" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics.map((topic) => (
          <LessonCard key={topic.id} topic={topic} progress={topic.progress} />
        ))}
      </div>
    </section>
  );
}
