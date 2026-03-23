export interface OutfitLook {
  principle: string
  caption: string
  trainerFill: string
  trainerStroke: string
  sockShow: boolean
  sockFill: string
  pantFill: string
  teeFill: string
  skinFill: string
  hairFill: string
  hairNote: string
  skinNote: string
}

function OutfitFigure({ look }: { look: OutfitLook }) {
  const cx = 60
  return (
    <svg
      viewBox="0 0 120 200"
      className="w-full max-w-[140px] mx-auto drop-shadow-lg"
      aria-hidden
    >
      {/* Hair */}
      <ellipse cx={cx} cy={28} rx={26} ry={22} fill={look.hairFill} />
      {/* Face */}
      <circle cx={cx} cy={36} r={18} fill={look.skinFill} />
      {/* Tee */}
      <path
        d={`M ${cx - 28} 52 L ${cx - 22} 48 L ${cx + 22} 48 L ${cx + 28} 52 L ${cx + 26} 88 L ${cx - 26} 88 Z`}
        fill={look.teeFill}
      />
      {/* Pants */}
      <path
        d={`M ${cx - 26} 88 L ${cx + 26} 88 L ${cx + 22} 150 L ${cx + 8} 150 L ${cx + 6} 110 L ${cx - 6} 110 L ${cx - 8} 150 L ${cx - 22} 150 Z`}
        fill={look.pantFill}
      />
      {/* Socks + trainers (ankle zone y≈150–172) */}
      {look.sockShow ? (
        <>
          <rect x={cx - 20} y={148} width={14} height={18} rx={2} fill={look.sockFill} />
          <rect x={cx + 6} y={148} width={14} height={18} rx={2} fill={look.sockFill} />
        </>
      ) : null}
      <rect
        x={cx - 22}
        y={164}
        width={18}
        height={12}
        rx={3}
        fill={look.trainerFill}
        stroke={look.trainerStroke}
        strokeWidth={1.5}
      />
      <rect
        x={cx + 4}
        y={164}
        width={18}
        height={12}
        rx={3}
        fill={look.trainerFill}
        stroke={look.trainerStroke}
        strokeWidth={1.5}
      />
    </svg>
  )
}

export function OutfitShowcase({ looks }: { looks: OutfitLook[] }) {
  return (
    <div className="my-10 space-y-12">
      <p className="text-sm text-[var(--muted)] border-l-2 border-[var(--accent-dim)] pl-4">
        Each figure is an abstract &ldquo;AI look&rdquo; — colour blocks stand in for garments so you can compare
        trainer, sock, pant, and tee relationships at a glance. Principles apply to real outfits and to images
        generated with tools like OneFit.
      </p>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map((look) => (
          <article
            key={look.principle}
            className="rounded-xl border border-[var(--surface)] bg-[#141011] p-4 flex flex-col"
          >
            <h3 className="text-sm font-semibold text-[var(--accent)] mb-1">{look.principle}</h3>
            <div className="flex-1 flex items-center justify-center py-4 bg-black/20 rounded-lg">
              <OutfitFigure look={look} />
            </div>
            <p className="text-xs text-[var(--muted)] mt-3 leading-relaxed">{look.caption}</p>
            <p className="text-[11px] text-[var(--muted)] mt-2 opacity-90">
              <span className="text-[var(--text)]">Skin / hair:</span> {look.skinNote} · {look.hairNote}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
