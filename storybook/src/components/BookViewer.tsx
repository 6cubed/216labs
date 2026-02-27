"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, BookOpen, Loader2 } from "lucide-react";

export interface BookPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl: string | null;
  loading?: boolean;
}

interface BookViewerProps {
  title: string;
  subtitle: string;
  childName: string;
  pages: BookPage[];
}

const COVER_PAGE_INDEX = -1;

export default function BookViewer({
  title,
  subtitle,
  childName,
  pages,
}: BookViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(COVER_PAGE_INDEX);

  const totalPages = pages.length;
  const isOnCover = currentIndex === COVER_PAGE_INDEX;
  const isOnLastPage = currentIndex === totalPages - 1;

  const currentPage = isOnCover ? null : pages[currentIndex];

  const goNext = () => {
    if (!isOnLastPage) setCurrentIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (currentIndex > COVER_PAGE_INDEX) setCurrentIndex((i) => i - 1);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Book container */}
      <div className="relative book-shadow rounded-3xl overflow-hidden bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {isOnCover ? (
              <CoverPage title={title} subtitle={subtitle} childName={childName} />
            ) : (
              <StoryPage page={currentPage!} pageNum={currentIndex + 1} totalPages={totalPages} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 px-2">
        <button
          onClick={goPrev}
          disabled={currentIndex === COVER_PAGE_INDEX}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold transition-all
            disabled:opacity-30 disabled:cursor-not-allowed
            bg-white border-2 border-story-purple-light text-story-purple hover:bg-story-purple-light"
        >
          <ChevronLeft className="w-5 h-5" />
          {currentIndex === 0 ? "Cover" : "Previous"}
        </button>

        <div className="flex items-center gap-2">
          {/* Dot indicators */}
          <button
            onClick={() => setCurrentIndex(COVER_PAGE_INDEX)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              isOnCover ? "bg-story-purple scale-125" : "bg-story-purple-light"
            }`}
          />
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                currentIndex === i ? "bg-story-purple scale-125" : "bg-story-purple-light"
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={isOnLastPage}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold transition-all
            disabled:opacity-30 disabled:cursor-not-allowed
            bg-story-purple text-white hover:bg-purple-700"
        >
          {isOnCover ? "Start Reading" : "Next"}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Page label */}
      <p className="text-center text-sm text-gray-400 mt-3">
        {isOnCover
          ? "Cover"
          : `Page ${currentIndex + 1} of ${totalPages}`}
      </p>
    </div>
  );
}

function CoverPage({
  title,
  subtitle,
  childName,
}: {
  title: string;
  subtitle: string;
  childName: string;
}) {
  return (
    <div className="relative min-h-[520px] flex flex-col items-center justify-center p-10 bg-gradient-to-b from-story-purple via-story-pink to-story-yellow-light text-white text-center">
      {/* Decorative stars */}
      {["top-6 left-8", "top-12 right-12", "bottom-16 left-16", "top-32 right-6"].map(
        (pos) => (
          <span
            key={pos}
            className={`absolute ${pos} text-white/30 text-4xl select-none`}
          >
            ✦
          </span>
        )
      )}
      <div className="relative z-10">
        <BookOpen className="w-16 h-16 mx-auto mb-6 text-white/80" />
        <h1 className="text-4xl font-display font-bold mb-3 leading-tight drop-shadow-lg">
          {title}
        </h1>
        <p className="text-lg text-white/80 mb-6 italic">{subtitle}</p>
        {childName && (
          <p className="text-white/70 text-sm">
            A special story for <span className="font-semibold text-white">{childName}</span>
          </p>
        )}
        <div className="mt-6 w-20 h-1 bg-white/40 rounded-full mx-auto" />
        <p className="mt-4 text-white/50 text-xs uppercase tracking-widest">
          StoryMagic · AI Illustrated
        </p>
      </div>
    </div>
  );
}

function StoryPage({
  page,
  pageNum,
  totalPages,
}: {
  page: BookPage;
  pageNum: number;
  totalPages: number;
}) {
  const isLastPage = pageNum === totalPages;

  return (
    <div className="min-h-[520px] flex flex-col">
      {/* Illustration */}
      <div className="relative w-full aspect-square bg-gradient-to-br from-story-purple-light to-story-pink-light flex items-center justify-center overflow-hidden">
        {page.loading && !page.imageUrl ? (
          <div className="flex flex-col items-center gap-3 text-story-purple">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-medium">Illustrating page {pageNum}…</p>
          </div>
        ) : page.imageUrl ? (
          <Image
            src={page.imageUrl}
            alt={`Illustration for page ${pageNum}`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="shimmer absolute inset-0" />
        )}

        {/* Page number badge */}
        <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm text-story-purple text-xs font-bold px-2 py-1 rounded-full">
          {pageNum} / {totalPages}
        </div>
      </div>

      {/* Story text */}
      <div className="flex-1 p-8 bg-white">
        {isLastPage ? (
          <div className="text-center py-2">
            <p className="text-2xl font-display font-bold text-story-purple mb-3">
              The End ✨
            </p>
            <p className="text-gray-600 text-lg leading-relaxed">{page.text}</p>
          </div>
        ) : (
          <p className="text-gray-700 text-lg leading-relaxed font-display">
            {page.text}
          </p>
        )}
      </div>
    </div>
  );
}
