import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBooking, getBookingPage, getBookingSlots } from "@/lib/booking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Book an Appointment | Aegis Prime" },
      {
        name: "description",
        content: "Pick a time with your life insurance advisor — the meeting lands on their calendar instantly.",
      },
      { property: "og:title", content: "Book an Appointment | Aegis Prime" },
      {
        property: "og:description",
        content: "Pick a time with your life insurance advisor and get an instant calendar invite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingPage,
});

function localDateISO(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BookingPage() {
  const { slug } = Route.useParams();
  const loadPage = useServerFn(getBookingPage);
  const loadSlots = useServerFn(getBookingSlots);
  const book = useServerFn(createBooking);

  const [date, setDate] = useState(() => localDateISO(0));
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ startISO: string; timezone: string } | null>(null);

  const pageQuery = useQuery({
    queryKey: ["booking-page", slug],
    queryFn: () => loadPage({ data: { slug } }),
    retry: false,
  });

  const page = pageQuery.data;

  const slotsQuery = useQuery({
    queryKey: ["booking-slots", slug, date],
    queryFn: () => loadSlots({ data: { slug, date } }),
    enabled: Boolean(page),
  });

  const days = useMemo(() => {
    const horizon = page?.horizonDays ?? 14;
    return Array.from({ length: Math.min(horizon + 1, 21) }, (_, i) => localDateISO(i));
  }, [page?.horizonDays]);

  const bookMutation = useMutation({
    mutationFn: (values: { first_name: string; last_name: string; email: string; phone: string; reason: string }) =>
      book({ data: { slug, startISO: selected ?? "", ...values } }),
    onSuccess: (result) => setConfirmed({ startISO: result.startISO, timezone: result.timezone }),
    onError: (error: Error) => toast.error(error.message),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      toast.error("Please pick a time first.");
      return;
    }
    const form = new FormData(event.currentTarget);
    bookMutation.mutate({
      first_name: String(form.get("first_name") ?? ""),
      last_name: String(form.get("last_name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
  }

  const tz = page?.timezone ?? "UTC";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <div className="mb-8 flex items-center gap-3 text-brand-muted">
        <CalendarClock className="size-5" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Book an appointment</span>
      </div>

      {pageQuery.isLoading && <p className="text-sm text-brand-muted">Loading availability…</p>}

      {pageQuery.error && (
        <div className="rounded-xl border border-brand-border bg-brand-card p-8 text-center shadow-brand-card">
          <h1 className="text-lg font-semibold">This booking page isn't available</h1>
          <p className="mt-2 text-sm text-brand-muted">{(pageQuery.error as Error).message}</p>
        </div>
      )}

      {page && confirmed && (
        <div className="rounded-xl border border-brand-border bg-brand-card p-10 text-center shadow-brand-card">
          <CheckCircle2 className="mx-auto size-8 text-brand-accent" />
          <h1 className="mt-4 text-xl font-semibold">You're booked</h1>
          <p className="mt-3 text-sm text-brand-muted">
            {new Intl.DateTimeFormat("en-US", {
              timeZone: confirmed.timezone,
              dateStyle: "full",
              timeStyle: "short",
            }).format(new Date(confirmed.startISO))}{" "}
            ({confirmed.timezone.replace("_", " ")})
          </p>
          <p className="mt-2 text-sm text-brand-muted">
            {page.producerName} has it on their calendar and you'll receive an invite by email.
          </p>
        </div>
      )}

      {page && !confirmed && (
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight">{page.headline}</h1>
            <p className="mt-2 text-sm text-brand-muted">{page.intro}</p>
            <p className="mt-2 text-xs text-brand-muted">
              {page.slotMinutes}-minute meeting · times shown in {tz.replace("_", " ")}
            </p>
          </header>

          <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Pick a day</h2>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {days.map((day) => {
                const d = new Date(`${day}T12:00:00`);
                const isActive = day === date;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setDate(day);
                      setSelected(null);
                    }}
                    className={cn(
                      "min-w-[68px] rounded-lg border border-brand-border px-3 py-2 text-center text-xs transition-colors",
                      isActive ? "border-brand-accent bg-brand-accent text-brand-accent-foreground" : "hover:border-brand-accent",
                    )}
                  >
                    <span className="block font-semibold">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="block">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Pick a time</h2>
            {slotsQuery.isLoading && <p className="mt-3 text-sm text-brand-muted">Checking the calendar…</p>}
            {slotsQuery.data && slotsQuery.data.slots.length === 0 && (
              <p className="mt-3 text-sm text-brand-muted">No open times that day. Try another date.</p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(slotsQuery.data?.slots ?? []).map((slotISO) => (
                <button
                  key={slotISO}
                  type="button"
                  onClick={() => setSelected(slotISO)}
                  className={cn(
                    "rounded-lg border border-brand-border px-3 py-2 text-sm transition-colors",
                    selected === slotISO
                      ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                      : "hover:border-brand-accent",
                  )}
                >
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: tz,
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(slotISO))}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Your details</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" name="first_name" required />
                <Field label="Last name" name="last_name" required />
                <Field label="Email" name="email" type="email" required />
                <Field label="Phone" name="phone" type="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">What would you like to talk about?</Label>
                <Textarea id="reason" name="reason" rows={4} placeholder="Coverage goals, policy review, questions…" />
              </div>
              <Button type="submit" className="w-full" disabled={bookMutation.isPending || !selected}>
                {bookMutation.isPending
                  ? "Booking…"
                  : selected
                    ? "Confirm appointment"
                    : "Pick a time to continue"}
              </Button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
