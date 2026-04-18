import Link from "next/link";
import { CheckCircle2, Mail, MapPin, Package } from "lucide-react";
import { getPrint } from "@/lib/catalog";
import { getOrderBySession } from "@/lib/db";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  const order = sessionId ? getOrderBySession(sessionId) : null;
  const print = order ? getPrint(order.printId) : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-paper">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-full bg-ink flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-paper" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-ink/10 p-8 text-center">
          <h1 className="font-display text-3xl text-ink mb-2">Order confirmed</h1>
          <p className="text-muted text-sm mb-8">
            {order?.customerName
              ? `Thank you, ${order.customerName.split(" ")[0]}. `
              : "Thank you. "}
            Your print is queued for fulfillment.
          </p>

          {print && (
            <div className="bg-paper rounded-xl p-4 mb-6 text-left border border-ink/5">
              <p className="font-display text-lg text-ink">{print.title}</p>
              <p className="text-xs text-muted mt-1">
                {print.medium} · {print.dimensions}
              </p>
            </div>
          )}

          {order && (
            <div className="space-y-3 mb-8 text-sm text-left">
              {order.customerEmail && (
                <div className="flex items-center gap-3 text-muted">
                  <Mail className="w-4 h-4 text-ink flex-shrink-0" />
                  <span>{order.customerEmail}</span>
                </div>
              )}
              {order.shippingAddress && (
                <div className="flex items-start gap-3 text-muted">
                  <MapPin className="w-4 h-4 text-ink flex-shrink-0 mt-0.5" />
                  <span>{order.shippingAddress}</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-ink/10 pt-6 mb-8 text-left">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">
              What happens next
            </h2>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                Payment captured — production can start
              </li>
              <li className="flex gap-2">
                <Package className="w-4 h-4 text-ink/30 flex-shrink-0 mt-0.5" />
                Print & pack (typically 3–5 business days)
              </li>
              <li className="flex gap-2">
                <Package className="w-4 h-4 text-ink/30 flex-shrink-0 mt-0.5" />
                Shipped to the address from Stripe checkout
              </li>
            </ul>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper hover:opacity-90"
          >
            Back to gallery
          </Link>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          <a href="mailto:hello@216labs.com" className="underline hover:text-ink">
            hello@216labs.com
          </a>
        </p>
      </div>
    </main>
  );
}
