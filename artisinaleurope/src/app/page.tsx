"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { experiences, CATEGORIES, type Category } from "@/data/experiences";
import { getFlag } from "@/components/ExperienceCard";

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "bg-amber-100 text-amber-800",
  "Music & Festivals": "bg-purple-100 text-purple-800",
  "Culture & History": "bg-blue-100 text-blue-800",
  "Nature & Adventure": "bg-green-100 text-green-800",
  "Artisan & Craft": "bg-orange-100 text-orange-800",
  "Ritual & Ceremony": "bg-rose-100 text-rose-800",
};

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered =
    activeCategory === "All"
      ? experiences
      : experiences.filter((e) => e.categories.includes(activeCategory));

  const topThree = experiences.slice(0, 3);

  return (
    <div className="bg-cream-100 min-h-screen">
      {/* Hero */}
      <section className="relative bg-[#0f1729] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="grid grid-cols-3 h-full">
            {topThree.map((exp) => (
              <div key={exp.id} className="relative overflow-hidden">
                <Image
                  src={exp.heroImage}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="33vw"
                  priority
                />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1729]/60 via-[#0f1729]/80 to-[#0f1729]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-[#c9a84c]/20 border border-[#c9a84c]/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-[#c9a84c] text-xs font-semibold tracking-widest uppercase">The Essential List</span>
          </div>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            50 Essential<br />
            <span className="italic text-[#c9a84c]">European</span> Experiences
          </h1>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            From a bespoke Milanese suit to the aurora over Iceland, from fado at midnight in Lisbon 
            to marzipan made by nuns in Toledo — the most authentic, irreplaceable things Europe offers.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-white/40">
            <span>50 cities</span>
            <span className="text-white/20">·</span>
            <span>27 countries</span>
            <span className="text-white/20">·</span>
            <span>1 continent</span>
            <span className="text-white/20">·</span>
            <span>Ranked by essentialness</span>
          </div>
        </div>
      </section>

      {/* Top 3 Featured */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {topThree.map((exp) => (
            <Link key={exp.id} href={`/experience/${exp.slug}`} className="group block">
              <article className="relative overflow-hidden rounded-2xl shadow-xl aspect-[4/3] bg-[#0f1729]">
                <Image
                  src={exp.heroImage}
                  alt={exp.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="font-serif font-bold italic text-6xl text-white/15 leading-none select-none">{exp.id}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span>{getFlag(exp.countryCode)}</span>
                    <span className="text-white/60 text-xs">{exp.city}, {exp.country}</span>
                  </div>
                  <h2 className="font-serif text-lg font-semibold text-white leading-snug group-hover:text-amber-300 transition-colors" style={{textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>
                    {exp.title}
                  </h2>
                  <p className="text-white/50 text-xs mt-1 line-clamp-2">{exp.tagline}</p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* Filter + Full List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="flex items-baseline gap-4 mb-6">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#0f1729]">
            The Full Ranking
          </h2>
          <span className="text-gray-400 text-sm">{filtered.length} experiences</span>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                activeCategory === cat
                  ? "bg-[#0f1729] text-white border-[#0f1729] shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#c9a84c] hover:text-[#1a2340]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          {filtered.map((exp) => (
            <Link key={exp.id} href={`/experience/${exp.slug}`} className="group block">
              <article className="flex gap-4 p-4 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200 border border-transparent hover:border-amber-100">
                <div className="flex-shrink-0 w-10 text-right pt-1.5">
                  <span className="font-serif font-bold italic text-2xl text-[#c9a84c]/50 leading-none">{exp.id}</span>
                </div>
                <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={exp.heroImage}
                    alt={exp.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="80px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base leading-none">{getFlag(exp.countryCode)}</span>
                    <span className="text-xs text-gray-500 font-medium">{exp.city}</span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-xs text-gray-400">{exp.country}</span>
                  </div>
                  <h3 className="font-serif text-sm font-semibold text-[#1a2340] leading-snug mb-1 group-hover:text-[#c9a84c] transition-colors line-clamp-2">
                    {exp.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1 leading-relaxed">{exp.tagline}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {exp.categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No experiences in this category yet.</p>
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-[#0f1729] rounded-2xl p-10 text-white">
          <h2 className="font-serif text-3xl font-semibold mb-3 italic">The world rewards the curious.</h2>
          <p className="text-white/50 max-w-lg mx-auto">
            Every experience on this list is real, achievable, and available to anyone willing to book a flight and 
            follow their instincts. Start anywhere. There is no wrong choice.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-3xl">
            {["🇮🇹","🇫🇷","🇪🇸","🇵🇹","🇬🇷","🇦🇹","🇮🇪","🇨🇿","🇧🇪","🇩🇰"].map((flag, i) => (
              <span key={i} className="hover:scale-125 transition-transform cursor-default">{flag}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
