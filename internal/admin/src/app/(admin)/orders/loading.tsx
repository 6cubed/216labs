export default function OrdersLoading() {
  return (
    <section className="animate-fade-in">
      <div className="h-7 w-40 rounded-md bg-white/5 mb-4 animate-pulse" />
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="h-12 border-b border-border bg-white/[0.02]" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 border-b border-border last:border-0 bg-white/[0.01] animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
