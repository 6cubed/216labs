import Link from "next/link";
import { CheckCircle2, BookOpen, Package, Mail, MapPin } from "lucide-react";
import { getOrderBySession, getBook } from "@/lib/db";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  const order = sessionId ? getOrderBySession(sessionId) : null;
  const book = order ? getBook(order.bookId) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-story-purple-light via-white to-story-teal-light flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        {/* Success icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-story-teal to-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-story-teal/30">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          <h1 className="text-3xl font-display font-bold text-story-dark mb-2">
            Order confirmed! 🎉
          </h1>
          <p className="text-gray-500 mb-8">
            {order?.customerName
              ? `Thanks, ${order.customerName.split(" ")[0]}! `
              : "Thanks! "}
            Your book is in the queue and will be printed and shipped shortly.
          </p>

          {/* Book details */}
          {book && (
            <div className="bg-story-purple-light rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-story-purple rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-bold text-story-dark">{book.title}</p>
                  <p className="text-sm text-gray-500 italic">{book.subtitle}</p>
                  {book.childName && (
                    <p className="text-xs text-story-purple mt-1 font-medium">
                      Personalised for {book.childName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Order details */}
          {order && (
            <div className="space-y-3 mb-8 text-sm text-left">
              {order.customerEmail && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-4 h-4 text-story-purple flex-shrink-0" />
                  <span>{order.customerEmail}</span>
                </div>
              )}
              {order.shippingAddress && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="w-4 h-4 text-story-purple flex-shrink-0 mt-0.5" />
                  <span>{order.shippingAddress}</span>
                </div>
              )}
            </div>
          )}

          {/* What happens next */}
          <div className="border-t border-gray-100 pt-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              What happens next
            </h2>
            <div className="space-y-3 text-left">
              {[
                { icon: CheckCircle2, text: "Payment confirmed — your order is placed", done: true },
                { icon: Package, text: "We print and bind your full-colour hardback (3–5 business days)", done: false },
                { icon: Package, text: "Shipped to your door with tracking (4–7 business days)", done: false },
              ].map(({ icon: Icon, text, done }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${done ? "text-story-teal" : "text-gray-300"}`} />
                  <span className={`text-sm ${done ? "text-story-dark font-medium" : "text-gray-400"}`}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-story-purple to-story-pink text-white rounded-2xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <BookOpen className="w-4 h-4" />
            Create another story
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Questions? Email us at{" "}
          <a href="mailto:hello@216labs.com" className="underline hover:text-gray-600">
            hello@216labs.com
          </a>
        </p>
      </div>
    </main>
  );
}
