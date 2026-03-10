import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import { LESSON_TOPICS } from "@/lib/prompts";

interface Props {
  params: { topicId: string };
}

export function generateStaticParams() {
  return LESSON_TOPICS.map((t) => ({ topicId: t.id }));
}

export default function LessonPage({ params }: Props) {
  const topic = LESSON_TOPICS.find((t) => t.id === params.topicId);
  if (!topic) notFound();

  return (
    <div className="h-screen flex flex-col max-w-3xl mx-auto px-4">
      <div className="py-3 flex-shrink-0 flex items-center gap-3">
        <Link
          href="/lessons"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft size={14} />
          Ceachtanna
        </Link>
        <span className="text-surface-300">/</span>
        <span className="text-sm text-surface-600">{topic.emoji} {topic.titleEn}</span>
      </div>

      <div className="flex-1 min-h-0 glass-card rounded-2xl overflow-hidden mb-4">
        <ChatInterface
          mode="lesson"
          topicId={topic.id}
          topicTitle={`${topic.emoji} ${topic.title}`}
          initialMessage="Start"
        />
      </div>
    </div>
  );
}
