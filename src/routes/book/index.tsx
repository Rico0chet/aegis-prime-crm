import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";

import { listBookingPages } from "@/lib/booking.functions";

export const Route = createFileRoute("/book/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Book an Appointment | Aegis Prime" },
      {
        name: "description",
        content: "Choose your life insurance advisor and book a consultation that syncs straight to their calendar.",
      },
      { property: "og:title", content: "Book an Appointment | Aegis Prime" },
      {
        property: "og:description",
        content: "Choose your life insurance advisor and book a consultation in a couple of clicks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingDirectory,
});

function BookingDirectory() {
  const load = useServerFn(listBookingPages);
  const { data, isLoading } = useQuery({ queryKey: ["booking-pages"], queryFn: () => load() });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <div className="mb-8 flex items-center gap-3 text-brand-muted">
        <CalendarClock className="size-5" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Book an appointment</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Choose your advisor</h1>
      <p className="mt-2 text-sm text-brand-muted">
        Pick the advisor you're working with to see their live availability.
      </p>

      {isLoading && <p className="mt-8 text-sm text-brand-muted">Loading advisors…</p>}

      {data && data.length === 0 && (
        <p className="mt-8 rounded-xl border border-brand-border bg-brand-card p-8 text-sm text-brand-muted">
          No advisor has published a booking page yet.
        </p>
      )}

      <div className="mt-8 space-y-3">
        {(data ?? []).map((page) => (
          <Link
            key={page.slug}
            to="/book/$slug"
            params={{ slug: page.slug }}
            className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-card p-5 shadow-brand-card transition-colors hover:border-brand-accent"
          >
            <span>
              <span className="block text-sm font-semibold">{page.name}</span>
              <span className="mt-0.5 block text-xs text-brand-muted">{page.agency ?? "Life insurance advisor"}</span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Book</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
