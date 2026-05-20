import type { StorybookPrintLead } from "@/lib/storybook";

export function StorybookPrintLeadsSection({ leads }: { leads: StorybookPrintLead[] }) {
  if (leads.length === 0) {
    return null;
  }

  return (
    <section className="animate-fade-in mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          StoryMagic print leads
          <span className="ml-2 text-sm font-normal text-muted">({leads.length})</span>
        </h2>
        <p className="text-xs text-muted max-w-md text-right">
          Emails captured while Stripe checkout is off — follow up before enabling pay.
        </p>
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Book</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-t border-border hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-accent hover:underline"
                  >
                    {lead.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {lead.bookTitle}
                  {lead.bookChildName ? (
                    <span className="text-xs text-muted block">for {lead.bookChildName}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {new Date(lead.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
