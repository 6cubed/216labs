"use client";

import Link from "next/link";
import { CheckCircle, Lock } from "lucide-react";
import { LessonTopic } from "@/lib/prompts";

interface LessonProgress {
  topic_id: string;
  completed_at: number | null;
  score: number;
  attempts: number;
}

interface LessonCardProps {
  topic: LessonTopic;
  progress: LessonProgress | null;
}

const LEVEL_COLORS = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-rose-100 text-rose-700",
};

export default function LessonCard({ topic, progress }: LessonCardProps) {
  const isCompleted = !!progress?.completed_at;
  const hasStarted = (progress?.attempts ?? 0) > 0;

  return (
    <Link
      href={`/lessons/${topic.id}`}
      className="glass-card rounded-2xl p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden"
    >
      {isCompleted && (
        <div className="absolute top-3 right-3 text-brand-500">
          <CheckCircle size={18} />
        </div>
      )}

      <div className="text-3xl mb-3">{topic.emoji}</div>

      <div className="mb-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${LEVEL_COLORS[topic.level]}`}
        >
          {topic.level}
        </span>
      </div>

      <h3 className="font-display font-bold text-surface-900 text-base leading-tight mb-0.5 group-hover:text-brand-700 transition-colors">
        {topic.title}
      </h3>
      <p className="text-xs text-surface-400 mb-3">{topic.titleEn}</p>
      <p className="text-sm text-surface-500 leading-relaxed">{topic.description}</p>

      {hasStarted && !isCompleted && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          In progress · {progress!.attempts} attempt{progress!.attempts !== 1 ? "s" : ""}
        </div>
      )}
      {isCompleted && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-brand-600 font-medium">
          <CheckCircle size={12} />
          Completed · Best score: {progress!.score}%
        </div>
      )}

      <div className="mt-4 flex items-center gap-1.5 text-brand-600 text-sm font-medium group-hover:gap-2.5 transition-all">
        {hasStarted ? "Continue" : "Start lesson"}
        <span className="text-base">→</span>
      </div>
    </Link>
  );
}
