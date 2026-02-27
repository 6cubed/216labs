"use client";

import Link from "next/link";
import { CheckCircle, BookOpen, Mail, Truck } from "lucide-react";
import { motion } from "framer-motion";

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-story-purple-light to-story-pink-light flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-10 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-24 h-24 bg-gradient-to-br from-story-purple to-story-pink rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-12 h-12 text-white" />
        </motion.div>

        <h1 className="text-3xl font-bold text-story-dark mb-3">
          Your book is on its way! 🎉
        </h1>
        <p className="text-gray-500 text-lg mb-8">
          Thank you for your order. Your personalised storybook is being
          printed and will arrive within 7–10 business days.
        </p>

        <div className="space-y-4 text-left mb-8">
          {[
            {
              icon: BookOpen,
              color: "text-story-purple",
              bg: "bg-story-purple-light",
              title: "Professionally printed",
              desc: "Full colour, high-quality printing on premium paper",
            },
            {
              icon: Mail,
              color: "text-story-pink",
              bg: "bg-story-pink-light",
              title: "Confirmation email",
              desc: "Check your inbox for your order details and tracking",
            },
            {
              icon: Truck,
              color: "text-story-teal",
              bg: "bg-story-teal-light",
              title: "Tracked shipping",
              desc: "Delivered in 7–10 business days",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="font-semibold text-story-dark">{title}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-story-purple to-story-pink text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity"
        >
          <BookOpen className="w-5 h-5" />
          Create another story
        </Link>
      </motion.div>
    </main>
  );
}
