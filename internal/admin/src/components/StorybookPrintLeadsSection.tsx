import type { StorybookPrintLead } from "@/lib/storybook";
import { ExportStorybookWaitlistButton } from "@/components/ExportStorybookWaitlistButton";
import { WaitlistPreorderBlastButton } from "@/components/WaitlistPreorderBlastButton";
import { WaitlistLaunchBlastButton } from "@/components/WaitlistLaunchBlastButton";

type Props = {
  leads: StorybookPrintLead[];
  preorderUrl?: string;
  priceUsd?: string;
};

export function StorybookPrintLeadsSection({ leads, preorderUrl, priceUsd }: Props) {
  if (leads.length === 0) {
    return null;
  }

  return (
    <section className="animate-fade-in mt-10">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">
          StoryMagic print leads
          <span className="ml-2 text-sm font-normal text-muted">({leads.length})</span>
        </h2>
        <div className="flex flex-col items-end gap-1">
        <p className="text-xs text-muted max-w-md text-right">
          {preorderUrl
            ? "Payment Link live — copy a blast email or export CSV for Resend."
            : "Emails captured while Stripe checkout is off — export for a preorder blast email."}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <WaitlistPreorderBlastButton
            leads={leads}
            preorderUrl={preorderUrl ?? ""}
            priceUsd={priceUsd}
          />
          {!preorderUrl ? (
            <WaitlistLaunchBlastButton leads={leads} priceUsd={priceUsd} />
          ) : null}
          <ExportStorybookWaitlistButton leads={leads} />
        </div>
        </div>
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Book</th>
              <th className="px-4 py-3 text-left font-medium">Campaign</th>
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
                <td className="px-4 py-3 text-xs text-muted max-w-[12rem]">
                  {lead.utmSource || lead.utmMedium || lead.utmCampaign ? (
                    <>
                      {lead.utmSource ? <span className="block">{lead.utmSource}</span> : null}
                      {lead.utmMedium ? (
                        <span className="block text-muted/80">{lead.utmMedium}</span>
                      ) : null}
                      {lead.utmCampaign ? (
                        <span className="block truncate" title={lead.utmCampaign ?? ""}>
                          {lead.utmCampaign}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
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
