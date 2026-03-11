import Link from "next/link";
import Image from "next/image";
import type { Experience } from "@/data/experiences";

const FLAG_MAP: Record<string, string> = {
  IT: "🇮🇹", IE: "🇮🇪", FR: "🇫🇷", ES: "🇪🇸", CZ: "🇨🇿", AT: "🇦🇹",
  PT: "🇵🇹", NL: "🇳🇱", GB: "🇬🇧", GR: "🇬🇷", HU: "🇭🇺", BE: "🇧🇪",
  DK: "🇩🇰", EE: "🇪🇪", SI: "🇸🇮", PL: "🇵🇱", MT: "🇲🇹", IS: "🇮🇸",
  ME: "🇲🇪", FI: "🇫🇮", CH: "🇨🇭", HR: "🇭🇷", NO: "🇳🇴", LV: "🇱🇻",
  BA: "🇧🇦", SE: "🇸🇪", LT: "🇱🇹",
};

export function getFlag(countryCode: string): string {
  return FLAG_MAP[countryCode] ?? "🏳";
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "bg-amber-100 text-amber-800",
  "Music & Festivals": "bg-purple-100 text-purple-800",
  "Culture & History": "bg-blue-100 text-blue-800",
  "Nature & Adventure": "bg-green-100 text-green-800",
  "Artisan & Craft": "bg-orange-100 text-orange-800",
  "Ritual & Ceremony": "bg-rose-100 text-rose-800",
};

interface ExperienceCardProps {
  experience: Experience;
  featured?: boolean;
}

export default function ExperienceCard({ experience, featured = false }: ExperienceCardProps) {
  const flag = getFlag(experience.countryCode);

  if (featured) {
    return (
      <Link href={`/experience/${experience.slug}`} className="group block">
        <article className="relative overflow-hidden rounded-2xl shadow-xl aspect-[4/3] bg-navy-900">
          <Image
            src={experience.heroImage}
            alt={experience.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="rank-badge text-5xl text-white/20 leading-none select-none">{experience.id}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{flag}</span>
              <span className="text-white/70 text-sm font-light">{experience.city}, {experience.country}</span>
            </div>
            <h2 className="font-serif text-xl font-semibold text-white leading-snug mb-2 text-shadow group-hover:text-amber-300 transition-colors">
              {experience.title}
            </h2>
            <p className="text-white/60 text-sm leading-relaxed line-clamp-2">{experience.tagline}</p>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/experience/${experience.slug}`} className="group block">
      <article className="flex gap-4 p-4 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200 border border-transparent hover:border-amber-200">
        <div className="flex-shrink-0 w-10 text-right pt-1">
          <span className="rank-badge text-2xl text-[#c9a84c]/60 leading-none">{experience.id}</span>
        </div>
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-navy-100">
          <Image
            src={experience.heroImage}
            alt={experience.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="80px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{flag}</span>
            <span className="text-xs text-gray-500 font-medium">{experience.city}</span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-xs text-gray-400">{experience.country}</span>
          </div>
          <h3 className="font-serif text-base font-semibold text-[#1a2340] leading-snug mb-1 group-hover:text-[#c9a84c] transition-colors line-clamp-2">
            {experience.title}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{experience.tagline}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {experience.categories.slice(0, 2).map((cat) => (
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
  );
}
