"use client";

import { useEffect, useState } from "react";

const MATCH_DATE = new Date("2026-04-01T12:00:00+01:00");

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(): TimeLeft {
  const now = new Date();
  const diff = MATCH_DATE.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function DigitBlock({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const display = String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
        <span className="text-3xl sm:text-4xl font-bold tabular-nums text-[#1a1a1a]">
          {display}
        </span>
      </div>
      <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">
        {label}
      </span>
    </div>
  );
}

export default function Countdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const expired =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  if (!mounted) {
    return (
      <div className="flex gap-4 sm:gap-6 justify-center opacity-0">
        <DigitBlock value={0} label="Days" />
        <DigitBlock value={0} label="Hours" />
        <DigitBlock value={0} label="Minutes" />
        <DigitBlock value={0} label="Seconds" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="text-center">
        <p className="text-2xl font-bold text-[#d52b1e]">
          The matches have been made! 💌
        </p>
        <p className="text-gray-500 mt-2">Check your email for your match.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 sm:gap-6 justify-center">
      <DigitBlock value={timeLeft.days} label="Days" />
      <DigitBlock value={timeLeft.hours} label="Hours" />
      <DigitBlock value={timeLeft.minutes} label="Minutes" />
      <DigitBlock value={timeLeft.seconds} label="Seconds" />
    </div>
  );
}
