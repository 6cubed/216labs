import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { experiences } from "@/data/experiences";
import { getFlag } from "@/components/ExperienceCard";
import Quiz from "@/components/Quiz";

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "bg-amber-100 text-amber-800",
  "Music & Festivals": "bg-purple-100 text-purple-800",
  "Culture & History": "bg-blue-100 text-blue-800",
  "Nature & Adventure": "bg-green-100 text-green-800",
  "Artisan & Craft": "bg-orange-100 text-orange-800",
  "Ritual & Ceremony": "bg-rose-100 text-rose-800",
};

export function generateStaticParams() {
  return experiences.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = experiences.find((e) => e.slug === slug);
  if (!exp) return {};
  return {
    title: `${exp.title} — Artisanal Europe`,
    description: exp.tagline,
  };
}

export default async function ExperiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = experiences.find((e) => e.slug === slug);
  if (!exp) notFound();

  const flag = getFlag(exp.countryCode);

  const related = experiences
    .filter(
      (e) =>
        e.id !== exp.id &&
        e.categories.some((c) => exp.categories.includes(c))
    )
    .slice(0, 3);

  return (
    <div className="bg-cream-100 min-h-screen">
      {/* Hero */}
      <section className="relative h-[55vh] min-h-[400px] bg-[#0f1729] overflow-hidden">
        <Image
          src={exp.heroImage}
          alt={exp.title}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

        {/* Back link */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-sm text-white/80 hover:text-white px-3 py-1.5 rounded-full text-sm transition-colors border border-white/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All Experiences
          </Link>
        </div>

        {/* Rank badge */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 text-center">
            <span className="text-white/40 text-xs block leading-none mb-0.5">Rank</span>
            <span className="font-serif font-bold italic text-3xl text-white/80 leading-none">#{exp.id}</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl mx-auto w-full" style={{left:'50%', transform:'translateX(-50%)'}}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{flag}</span>
            <Link
              href={`/?country=${exp.countryCode}`}
              className="text-white/60 hover:text-white/80 text-sm transition-colors"
            >
              {exp.city}, {exp.country}
            </Link>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-3" style={{textShadow:'0 2px 8px rgba(0,0,0,0.6)'}}>
            {exp.title}
          </h1>
          <p className="text-white/65 text-base sm:text-lg leading-relaxed max-w-3xl" style={{textShadow:'0 1px 3px rgba(0,0,0,0.4)'}}>
            {exp.tagline}
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {exp.categories.map((cat) => (
                <span
                  key={cat}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {cat}
                </span>
              ))}
            </div>

            {/* Prose */}
            <section className="prose-editorial">
              {exp.description.map((para, i) => (
                <p key={i} className="text-[#2d3a52] text-[1.05rem] leading-[1.85] mb-6">
                  {para}
                </p>
              ))}
            </section>

            {/* Tips */}
            <section className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
              <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
                <h2 className="font-serif text-lg font-semibold text-[#1a2340]">Practical Tips</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {exp.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-4 px-6 py-4">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c9a84c]/15 text-[#c9a84c] text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Quiz */}
            <Quiz questions={exp.quiz} title={`How well do you know ${exp.city}?`} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Quick facts */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-serif text-base font-semibold text-[#1a2340] mb-4">Quick Facts</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-0.5">Location</dt>
                  <dd className="text-gray-700 flex items-center gap-1.5">
                    <span>{flag}</span>
                    <span>{exp.city}, {exp.country}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-0.5">Best Time</dt>
                  <dd className="text-gray-700">{exp.bestTime}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-0.5">Duration</dt>
                  <dd className="text-gray-700">{exp.duration}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-0.5">Category</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {exp.categories.map((cat) => (
                      <span
                        key={cat}
                        className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {cat}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Ranking position */}
            <div className="bg-[#0f1729] rounded-2xl p-6 text-center">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Ranked</p>
              <p className="font-serif font-bold italic text-6xl text-[#c9a84c] leading-none">#{exp.id}</p>
              <p className="text-white/40 text-xs mt-2">of 50 essential experiences</p>
              <div className="mt-4 w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-[#c9a84c] h-1.5 rounded-full transition-all"
                  style={{ width: `${((51 - exp.id) / 50) * 100}%` }}
                />
              </div>
              <p className="text-white/25 text-xs mt-2">
                {exp.id <= 10 ? "Top 10 — truly unmissable" : exp.id <= 25 ? "Essential" : "Highly recommended"}
              </p>
            </div>

            {/* Related */}
            {related.length > 0 && (
              <div>
                <h3 className="font-serif text-base font-semibold text-[#1a2340] mb-3">Related Experiences</h3>
                <div className="space-y-2">
                  {related.map((rel) => (
                    <Link key={rel.id} href={`/experience/${rel.slug}`} className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-amber-100">
                      <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={rel.heroImage}
                          alt={rel.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                          sizes="48px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-xs">{getFlag(rel.countryCode)}</span>
                          <span className="text-xs text-gray-400">{rel.city}</span>
                        </div>
                        <p className="font-serif text-xs font-semibold text-[#1a2340] group-hover:text-[#c9a84c] transition-colors leading-snug line-clamp-2">
                          {rel.title}
                        </p>
                      </div>
                      <span className="text-gray-300 text-xs mt-1">#{rel.id}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Back to list CTA */}
            <Link
              href="/"
              className="block w-full text-center bg-white border border-gray-200 text-[#1a2340] hover:border-[#c9a84c] hover:text-[#c9a84c] py-3 rounded-xl text-sm font-medium transition-all"
            >
              View All 50 Experiences →
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
