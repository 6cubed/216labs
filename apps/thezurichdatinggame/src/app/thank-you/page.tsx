import Link from "next/link";

export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-[#d52b1e] rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-200">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-[#1a1a1a] mb-3">
          You&apos;re in the game!
        </h1>
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Your profile has been saved. On{" "}
          <strong className="text-[#1a1a1a]">April 1st</strong>, our AI
          matchmaker will find your perfect first date in Zurich and send the
          details to your email.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8 text-left space-y-4">
          <h2 className="font-semibold text-[#1a1a1a]">What happens next?</h2>
          <div className="space-y-3">
            <TimelineItem
              dot="🗓"
              text="Keep an eye on your inbox on April 1st — we'll email you your match."
            />
            <TimelineItem
              dot="💬"
              text="Your match will receive the same email. Reach out and say hi!"
            />
            <TimelineItem
              dot="☕"
              text="Suggest one of the spots from your perfect first date description."
            />
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-8">
          Know someone who&apos;d love this? Tell them to sign up before April 1st.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="block w-full bg-[#d52b1e] text-white py-3 rounded-full font-semibold hover:bg-[#b02318] transition-colors text-center"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

function TimelineItem({ dot, text }: { dot: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl shrink-0">{dot}</span>
      <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
    </div>
  );
}
