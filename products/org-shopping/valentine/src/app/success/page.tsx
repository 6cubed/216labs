import Link from "next/link";
import { CheckCircle2, Heart, Package, Mail, MapPin } from "lucide-react";
import { getOrderBySession, getCard } from "@/lib/db";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  const order = sessionId ? getOrderBySession(sessionId) : null;
  const card = order ? getCard(order.cardId) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-heart-rose-light via-white to-heart-rose-light/50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-heart-rose to-heart-wine rounded-full flex items-center justify-center shadow-lg shadow-heart-rose/30">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-heart-rose-light p-8 text-center">
          <h1 className="text-3xl font-display font-bold text-heart-ink mb-2">
            Order confirmed
          </h1>
          <p className="text-gray-500 mb-8">
            {order?.customerName
              ? `Thanks, ${order.customerName.split(" ")[0]}. `
              : "Thanks! "}
            Your card is in the print queue.
          </p>

          {card && (
            <div className="bg-heart-rose-light/60 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-heart-rose rounded-xl flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 text-white fill-white" />
                </div>
                <div>
                  <p className="font-bold text-heart-ink">{card.title}</p>
                  {card.recipientName && (
                    <p className="text-xs text-heart-rose mt-1 font-medium">
                      For {card.recipientName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {order && (
            <div className="space-y-3 mb-8 text-sm text-left">
              {order.customerEmail && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-4 h-4 text-heart-rose flex-shrink-0" />
                  <span>{order.customerEmail}</span>
                </div>
              )}
              {order.shippingAddress && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="w-4 h-4 text-heart-rose flex-shrink-0 mt-0.5" />
                  <span>{order.shippingAddress}</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              What happens next
            </h2>
            <div className="space-y-3 text-left">
              {[
                { icon: CheckCircle2, text: "Payment confirmed — your order is placed", done: true },
                { icon: Package, text: "We print your card on premium stock (2–4 business days)", done: false },
                { icon: Package, text: "Shipped with tracking to your door", done: false },
              ].map(({ icon: Icon, text, done }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${done ? "text-emerald-500" : "text-gray-300"}`} />
                  <span className={`text-sm ${done ? "text-heart-ink font-medium" : "text-gray-400"}`}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-heart-rose to-heart-wine text-white rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Heart className="w-4 h-4" />
            Create another card
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Questions?{" "}
          <a href="mailto:hello@216labs.com" className="underline hover:text-gray-600">
            hello@216labs.com
          </a>
        </p>
      </div>
    </main>
  );
}
