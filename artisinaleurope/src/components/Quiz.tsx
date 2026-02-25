"use client";

import { useState } from "react";
import type { Quiz as QuizType } from "@/data/experiences";
import clsx from "clsx";

interface QuizProps {
  questions: QuizType[];
  title?: string;
}

export default function Quiz({ questions, title = "Test Your Knowledge" }: QuizProps) {
  const [answers, setAnswers] = useState<Record<number, number | null>>(
    Object.fromEntries(questions.map((_, i) => [i, null]))
  );
  const [revealed, setRevealed] = useState<Record<number, boolean>>(
    Object.fromEntries(questions.map((_, i) => [i, false]))
  );
  const [score, setScore] = useState<number | null>(null);

  function handleAnswer(questionIdx: number, optionIdx: number) {
    if (revealed[questionIdx]) return;
    setAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }));
  }

  function checkAnswer(questionIdx: number) {
    if (answers[questionIdx] === null) return;
    setRevealed((prev) => ({ ...prev, [questionIdx]: true }));
  }

  function calculateScore() {
    const total = questions.reduce((sum, q, i) => {
      return sum + (answers[i] === q.correctIndex ? 1 : 0);
    }, 0);
    setScore(total);
  }

  const allAnswered = Object.values(answers).every((a) => a !== null);
  const allRevealed = Object.values(revealed).every(Boolean);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#0f1729] to-[#1a2340] px-6 py-5">
        <h2 className="font-serif text-xl text-white font-semibold">{title}</h2>
        <p className="text-white/50 text-sm mt-1">{questions.length} questions about this experience</p>
      </div>

      <div className="divide-y divide-gray-100">
        {questions.map((q, qi) => {
          const selected = answers[qi];
          const isRevealed = revealed[qi];
          const isCorrect = selected === q.correctIndex;

          return (
            <div key={qi} className="p-6">
              <p className="font-medium text-[#1a2340] leading-snug mb-4">
                <span className="text-[#c9a84c] font-serif mr-2 font-semibold">{qi + 1}.</span>
                {q.question}
              </p>

              <div className="space-y-2 mb-4">
                {q.options.map((option, oi) => {
                  const isSelected = selected === oi;
                  const showCorrect = isRevealed && oi === q.correctIndex;
                  const showWrong = isRevealed && isSelected && !isCorrect;

                  return (
                    <button
                      key={oi}
                      onClick={() => handleAnswer(qi, oi)}
                      className={clsx(
                        "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-200",
                        !isRevealed && !isSelected && "border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700",
                        !isRevealed && isSelected && "border-[#c9a84c] bg-amber-50 text-[#1a2340] font-medium",
                        showCorrect && "border-green-400 bg-green-50 text-green-800 font-medium",
                        showWrong && "border-red-300 bg-red-50 text-red-700",
                        isRevealed && !showCorrect && !showWrong && "border-gray-100 text-gray-400 opacity-60",
                        isRevealed && "cursor-default"
                      )}
                    >
                      <span className="inline-flex items-start gap-3">
                        <span className={clsx(
                          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5",
                          !isRevealed && !isSelected && "border-gray-300 text-gray-400",
                          !isRevealed && isSelected && "border-[#c9a84c] bg-[#c9a84c] text-white",
                          showCorrect && "border-green-500 bg-green-500 text-white",
                          showWrong && "border-red-400 bg-red-400 text-white",
                          isRevealed && !showCorrect && !showWrong && "border-gray-200 text-gray-300"
                        )}>
                          {showCorrect ? "✓" : showWrong ? "✗" : String.fromCharCode(65 + oi)}
                        </span>
                        <span>{option}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {!isRevealed && selected !== null && (
                <button
                  onClick={() => checkAnswer(qi)}
                  className="text-sm bg-[#c9a84c] text-white px-4 py-2 rounded-lg hover:bg-[#a8893e] transition-colors font-medium"
                >
                  Check Answer
                </button>
              )}

              {isRevealed && (
                <div className={clsx(
                  "mt-3 p-4 rounded-lg text-sm leading-relaxed",
                  isCorrect ? "bg-green-50 border border-green-200 text-green-800" : "bg-amber-50 border border-amber-200 text-amber-900"
                )}>
                  <span className="font-semibold block mb-1">{isCorrect ? "Correct!" : "Not quite."}</span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allAnswered && !allRevealed && (
        <div className="px-6 pb-6">
          <button
            onClick={() => {
              setRevealed(Object.fromEntries(questions.map((_, i) => [i, true])));
              calculateScore();
            }}
            className="w-full bg-[#0f1729] text-white py-3 rounded-xl font-medium hover:bg-[#1a2340] transition-colors"
          >
            Reveal All Answers
          </button>
        </div>
      )}

      {score !== null && (
        <div className="mx-6 mb-6 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-5 text-center border border-amber-200">
          <p className="font-serif text-2xl font-bold text-[#1a2340]">
            {score} / {questions.length}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            {score === questions.length
              ? "Perfect score — you are well-prepared for this adventure."
              : score >= questions.length / 2
              ? "Well done. A bit of reading and you will be fully armed."
              : "Plenty to discover. That is the point of travel."}
          </p>
        </div>
      )}
    </section>
  );
}
