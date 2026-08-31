import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Copy, ExternalLink, Link2Off } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelAppointment,
  completeCalendarConnection,
  disconnectCalendar,
  getMyBookingSettings,
  listMyAppointments,
  saveMyBookingSettings,
  startCalendarConnect,
} from "@/lib/booking.functions";
import { cn } from "@/lib/utils";
import {
  OAUTH_CHANNEL,
  clearStoredOAuthOutcome,
  takeStoredOAuthOutcome,
} from "@/lib/oauth-handoff";

export const Route = createFileRoute("/_authenticated/booking")({
  head: () => ({
    meta: [
      { title: "Appointment Booking | Aegis Prime" },
      {
        name: "description",
        content: "Publish your personal booking page and sync every client appointment to your calendar.",
      },
      { property: "og:title", content: "Appointment Booking | Aegis Prime" },
      {
        property: "og:description",
        content: "Publish your personal booking page and sync every client appointment to your calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingAdminPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FormState = {
  slug: string;
  is_enabled: boolean;
  headline: string;
  intro: string;
  timezone: string;
  work_days: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
  lead_hours: number;
  horizon_days: number;
};

const DEFAULTS: FormState = {
  slug: "",
  is_enabled: false,
  headline: "",
  intro: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver",
  work_days: [1, 2, 3, 4, 5],
  start_time: "09:00",
  end_time: "17:00",
  slot_minutes: 30,
  buffer_minutes: 0,
  lead_hours: 12,
  horizon_days: 21,
};

function waitForOAuthCompletion(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.data?.connectorId !== "google_calendar" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("The calendar connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      // Grace period: the message can still be in flight when the popup closes.
      window.clearInterval(poll);
      window.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "The Google window closed before the connection finished. Try again and complete the Google approval screen.",
          ),
        );
      }, 2000);
    }, 500);
  });
}

/** Fallback used when the browser (or the embedded preview) blocks popups. */
function waitForOAuthCompletionFromAnyWindow() {
  return new Promise<string | null>((resolve, reject) => {
    const startedAt = Date.now();
    clearStoredOAuthOutcome();
    let timeout: number | undefined;
    let poll: number | undefined;
    let channel: BroadcastChannel | null = null;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (poll !== undefined) window.clearInterval(poll);
      try {
        channel?.close();
      } catch {
        /* ignore */
      }
    };
    const settle = (data: { type?: string; code?: unknown }) => {
      cleanup();
      if (data.type === "appUserConnectorOAuthComplete") {
        resolve(typeof data.code === "string" ? data.code : null);
        return;
      }
      reject(new Error("The calendar connection failed."));
    };
    const accepts = (data: { type?: string; connectorId?: string }) =>
      data?.connectorId === "google_calendar" &&
      (data.type === "appUserConnectorOAuthComplete" ||
        data.type === "appUserConnectorOAuthFailed");

    const onMessage = (event: MessageEvent) => {
      if (accepts(event.data ?? {})) settle(event.data);
    };
    window.addEventListener("message", onMessage);

    try {
      channel = new BroadcastChannel(OAUTH_CHANNEL);
      channel.onmessage = (event) => {
        if (accepts(event.data ?? {})) settle(event.data);
      };
    } catch {
      /* BroadcastChannel unavailable */
    }

    // localStorage poll: covers browsers/tabs where BroadcastChannel and
    // postMessage both miss (standalone tab opened from a copied link).
    poll = window.setInterval(() => {
      const stored = takeStoredOAuthOutcome(startedAt);
      if (stored) settle(stored);
    }, 800);

    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for Google. Try the connect link again."));
    }, 10 * 60 * 1000);
  });
}


function BookingAdminPage() {
  const queryClient = useQueryClient();
  const loadSettings = useServerFn(getMyBookingSettings);
  const saveSettings = useServerFn(saveMyBookingSettings);
  const loadAppointments = useServerFn(listMyAppointments);
  const startConnect = useServerFn(startCalendarConnect);
  const completeConnect = useServerFn(completeCalendarConnection);
  const disconnect = useServerFn(disconnectCalendar);
  const cancel = useServerFn(cancelAppointment);

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);


  const settingsQuery = useQuery({ queryKey: ["booking-settings"], queryFn: () => loadSettings() });
  const appointmentsQuery = useQuery({
    queryKey: ["my-appointments"],
    queryFn: () => loadAppointments(),
  });

  useEffect(() => {
    const s = settingsQuery.data?.settings;
    if (!s) return;
    setForm({
      slug: s.slug,
      is_enabled: s.is_enabled,
      headline: s.headline ?? "",
      intro: s.intro ?? "",
      timezone: s.timezone,
      work_days: s.work_days,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      slot_minutes: s.slot_minutes,
      buffer_minutes: s.buffer_minutes,
      lead_hours: s.lead_hours,
      horizon_days: s.horizon_days,
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveSettings({ data: form }),
    onSuccess: () => {
      toast.success("Booking page saved");
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      // Inside the editor preview the app runs in a sandboxed iframe, where
      // Google's consent page is refused (ERR_BLOCKED_BY_RESPONSE). Skip the
      // popup there and hand the user a real new-tab link instead.
      const inIframe = window.self !== window.top;
      const popup = inIframe ? null : window.open("", "lovable-oauth", "width=600,height=720");
      let code: string | null = null;
      try {
        const { authorizationUrl } = await startConnect();
        if (popup) {
          const completion = waitForOAuthCompletion(popup);
          popup.location.href = authorizationUrl;
          code = await completion;
        } else {
          // No popup available: surface a link the user opens in a new tab.
          setFallbackUrl(authorizationUrl);
          code = await waitForOAuthCompletionFromAnyWindow();
        }
      } catch (error) {
        popup?.close();
        throw error;
      }
      if (code) await completeConnect({ data: { code } });
    },
    onSuccess: () => {
      setFallbackUrl(null);
      toast.success("Google Calendar connected");
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const disconnectMutation = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Calendar disconnected");
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Appointment cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connected = settingsQuery.data?.calendarConnected ?? false;
  const publicUrl =
    typeof window !== "undefined" && form.slug ? `${window.location.origin}/book/${form.slug}` : "";

  return (
    <AppShell title="Appointment Booking" eyebrow="Client scheduling">
      <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Calendar</h2>
            <p className="mt-2 text-sm">
              {connected
                ? "Google Calendar is connected. Bookings are written to your primary calendar and busy times are blocked automatically."
                : "Connect your Google Calendar so booked appointments land on it and your busy times stay protected."}
            </p>
          </div>
          {connected ? (
            <Button
              variant="outline"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Link2Off className="size-4" /> Disconnect
            </Button>
          ) : (
            <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              <CalendarCheck2 className="size-4" />
              {connectMutation.isPending ? "Connecting…" : "Connect Google Calendar"}
            </Button>
          )}
        </div>
        {!connected && fallbackUrl ? (
          <div className="mt-4 rounded-lg border border-brand-border bg-brand-bg p-4 text-sm">
            <p className="font-medium">Finish in a new browser tab</p>
            <p className="mt-1 text-brand-muted">
              Google blocks its sign-in page inside embedded previews. Open the authorization link
              below in a new tab — this page finishes the connection automatically once you approve.
              If nothing happens, open the app in its own browser tab and connect from there.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={fallbackUrl}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-md bg-brand-accent px-3 py-2 text-sm font-medium text-brand-accent-foreground"
              >
                <ExternalLink className="size-4" /> Open Google authorization
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(fallbackUrl);
                  toast.success("Authorization link copied");
                }}
              >
                <Copy className="size-4" /> Copy link
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Your booking page</h2>
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={form.is_enabled}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, is_enabled: checked }))}
            />
            {form.is_enabled ? "Live" : "Off"}
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slug">Link name</Label>
            <Input
              id="slug"
              value={form.slug}
              placeholder="marcus-thorne"
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
            {publicUrl && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                <span className="truncate">{publicUrl}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(publicUrl);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="size-3.5" /> Copy
                </Button>
                <Button type="button" size="sm" variant="ghost" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" /> Open
                  </a>
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Time zone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={form.headline}
              placeholder="Book an appointment with Marcus Thorne"
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="intro">Intro</Label>
            <Textarea
              id="intro"
              rows={3}
              value={form.intro}
              placeholder="Tell clients what to expect from the meeting."
              onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Label>Available days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, index) => {
              const active = form.work_days.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      work_days: active
                        ? f.work_days.filter((d) => d !== index)
                        : [...f.work_days, index].sort(),
                    }))
                  }
                  className={cn(
                    "rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                      : "hover:border-brand-accent",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <NumberField label="Day starts" value={form.start_time} type="time" onChange={(v) => setForm((f) => ({ ...f, start_time: v }))} />
          <NumberField label="Day ends" value={form.end_time} type="time" onChange={(v) => setForm((f) => ({ ...f, end_time: v }))} />
          <NumberField
            label="Meeting length (min)"
            value={String(form.slot_minutes)}
            type="number"
            onChange={(v) => setForm((f) => ({ ...f, slot_minutes: Number(v) }))}
          />
          <NumberField
            label="Buffer between meetings (min)"
            value={String(form.buffer_minutes)}
            type="number"
            onChange={(v) => setForm((f) => ({ ...f, buffer_minutes: Number(v) }))}
          />
          <NumberField
            label="Minimum notice (hours)"
            value={String(form.lead_hours)}
            type="number"
            onChange={(v) => setForm((f) => ({ ...f, lead_hours: Number(v) }))}
          />
          <NumberField
            label="Bookable days ahead"
            value={String(form.horizon_days)}
            type="number"
            onChange={(v) => setForm((f) => ({ ...f, horizon_days: Number(v) }))}
          />
        </div>

        <Button className="mt-6" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save booking page"}
        </Button>
      </section>

      <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-muted">Upcoming appointments</h2>
        {appointmentsQuery.data && appointmentsQuery.data.length === 0 && (
          <p className="mt-4 text-sm text-brand-muted">No appointments booked yet.</p>
        )}
        <div className="mt-4 space-y-3">
          {(appointmentsQuery.data ?? []).map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-border p-4"
            >
              <div>
                <p className="text-sm font-semibold">
                  {appointment.first_name} {appointment.last_name}
                  {appointment.status === "cancelled" && (
                    <span className="ml-2 text-xs font-normal text-brand-muted">(cancelled)</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: appointment.timezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(appointment.starts_at))}{" "}
                  · {appointment.email}
                  {appointment.phone ? ` · ${appointment.phone}` : ""}
                </p>
                {appointment.reason && <p className="mt-1 text-xs text-brand-muted">{appointment.reason}</p>}
              </div>
              {appointment.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancelMutation.mutate(appointment.id)}
                  disabled={cancelMutation.isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function NumberField({
  label,
  value,
  type,
  onChange,
}: {
  label: string;
  value: string;
  type: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
