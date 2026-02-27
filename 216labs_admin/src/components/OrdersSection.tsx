"use client";

import { useState, useTransition } from "react";
import { fulfillStorybookOrder } from "@/app/actions";
import type { StorybookOrder } from "@/lib/storybook";

const STATUS_STYLES: Record<StorybookOrder["status"], string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  fulfilled: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function OrderRow({ order }: { order: StorybookOrder }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(order.status === "fulfilled");

  const status = done ? "fulfilled" : order.status;

  return (
    <tr className="border-t border-border hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-foreground">{order.bookTitle}</p>
        {order.bookChildName && (
          <p className="text-xs text-muted">for {order.bookChildName}</p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-foreground">
        <p>{order.customerName ?? "—"}</p>
        {order.customerEmail && (
          <p className="text-xs text-muted">{order.customerEmail}</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted max-w-[200px] truncate">
        {order.shippingAddress ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}
        >
          {status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(order.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        {status !== "fulfilled" && (
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await fulfillStorybookOrder(order.id);
                setDone(true);
              })
            }
            className="text-xs px-3 py-1.5 rounded-md border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40 transition-colors"
          >
            {isPending ? "Saving…" : "Mark fulfilled"}
          </button>
        )}
      </td>
    </tr>
  );
}

export function OrdersSection({ orders }: { orders: StorybookOrder[] }) {
  if (orders.length === 0) {
    return (
      <section className="animate-fade-in">
        <h2 className="text-lg font-semibold text-foreground mb-4">Orders</h2>
        <div className="bg-surface border border-border rounded-xl p-6 text-center text-muted text-sm">
          No orders yet.{" "}
          {!process.env.NEXT_PUBLIC_STORYBOOK_CONFIGURED && (
            <span>Set <code className="font-mono">STORYBOOK_INTERNAL_URL</code> to connect.</span>
          )}
        </div>
      </section>
    );
  }

  const pending = orders.filter((o) => o.status === "pending").length;
  const paid = orders.filter((o) => o.status === "paid").length;
  const fulfilled = orders.filter((o) => o.status === "fulfilled").length;

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Orders
          <span className="ml-2 text-sm font-normal text-muted">
            ({orders.length} total)
          </span>
        </h2>
        <div className="flex gap-3 text-xs">
          <span className="text-yellow-400">{pending} pending</span>
          <span className="text-blue-400">{paid} paid</span>
          <span className="text-emerald-400">{fulfilled} fulfilled</span>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Book</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Ship to</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
