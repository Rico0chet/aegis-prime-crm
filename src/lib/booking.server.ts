import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getConnectionKeyForUser } from "@/server/appUserConnections.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CALENDAR_CONNECTOR_ID = "google_calendar";

export type BookingSettingsRow = {
  user_id: string;
  slug: string;
  is_enabled: boolean;
  calendar_provider: string;
  headline: string | null;
  intro: string | null;
  timezone: string;
  work_days: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
  lead_hours: number;
  horizon_days: number;
};

export type PublicBookingPage = {
  slug: string;
  producerName: string;
  agency: string | null;
  title: string | null;
  headline: string;
  intro: string;
  timezone: string;
  slotMinutes: number;
  horizonDays: number;
  workDays: number[];
};

export async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function cleanText(value: unknown, max = 200) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/* ---------------------------------- time ---------------------------------- */

function tzOffsetMs(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"]) === 24 ? 0 : Number(parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  return asUTC - instant.getTime();
}

/** Wall-clock time in `timeZone` -> UTC instant. */
export function zonedWallTimeToUtc(
  dateISO: string,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const guess = Date.UTC(y!, (m ?? 1) - 1, d!, 0, minutesFromMidnight);
  let offset = tzOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  offset = tzOffsetMs(new Date(result), timeZone);
  result = guess - offset;
  return new Date(result);
}

/** YYYY-MM-DD for an instant, in `timeZone`. */
export function isoDateInZone(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(instant);
}

export function weekdayInZone(dateISO: string, timeZone: string) {
  const noon = zonedWallTimeToUtc(dateISO, 12 * 60, timeZone);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function addDaysISO(dateISO: string, days: number) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y!, (m ?? 1) - 1, d!));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/* -------------------------------- calendar -------------------------------- */

type Busy = { start: number; end: number };

async function googleBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Busy[]> {
  const connectionAPIKey = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
  if (!connectionAPIKey) return [];
  try {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CALENDAR_CONNECTOR_ID,
      path: "/calendar/v3/freeBusy",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: "primary" }],
        }),
      },
    });
    if (!res.ok) {
      console.error(`freeBusy failed [${res.status}]: ${await res.text()}`);
      return [];
    }
    const body = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const busy = body.calendars?.["primary"]?.busy ?? [];
    return busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  } catch (error) {
    console.error("freeBusy lookup failed", error);
    return [];
  }
}

export async function loadBusy(userId: string, timeMin: Date, timeMax: Date): Promise<Busy[]> {
  const supabaseAdmin = await getAdminClient();
  const { data } = await supabaseAdmin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("user_id", userId)
    .eq("status", "booked")
    .lt("starts_at", timeMax.toISOString())
    .gt("ends_at", timeMin.toISOString());

  const local: Busy[] = (data ?? []).map((row) => ({
    start: Date.parse(row.starts_at),
    end: Date.parse(row.ends_at),
  }));
  const remote = await googleBusy(userId, timeMin, timeMax);
  return [...local, ...remote];
}

export function buildSlots(settings: BookingSettingsRow, dateISO: string): Date[] {
  if (!settings.work_days.includes(weekdayInZone(dateISO, settings.timezone))) return [];
  const step = Math.max(5, settings.slot_minutes + settings.buffer_minutes);
  const startM = timeToMinutes(settings.start_time);
  const endM = timeToMinutes(settings.end_time);
  const slots: Date[] = [];
  for (let m = startM; m + settings.slot_minutes <= endM; m += step) {
    slots.push(zonedWallTimeToUtc(dateISO, m, settings.timezone));
  }
  return slots;
}

export function filterAvailable(
  slots: Date[],
  busy: Busy[],
  slotMinutes: number,
  leadHours: number,
) {
  const earliest = Date.now() + leadHours * 3600_000;
  return slots.filter((slot) => {
    const start = slot.getTime();
    const end = start + slotMinutes * 60_000;
    if (start < earliest) return false;
    return !busy.some((b) => start < b.end && end > b.start);
  });
}

export async function createCalendarEvent(params: {
  userId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timezone: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<{ eventId: string | null; meetingUrl: string | null }> {
  const connectionAPIKey = await getConnectionKeyForUser(params.userId, CALENDAR_CONNECTOR_ID);
  if (!connectionAPIKey) return { eventId: null, meetingUrl: null };
  try {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CALENDAR_CONNECTOR_ID,
      path: "/calendar/v3/calendars/primary/events?sendUpdates=all",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: params.summary,
          description: params.description,
          start: { dateTime: params.start.toISOString(), timeZone: params.timezone },
          end: { dateTime: params.end.toISOString(), timeZone: params.timezone },
          attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
        }),
      },
    });
    if (!res.ok) {
      console.error(`Calendar event create failed [${res.status}]: ${await res.text()}`);
      return { eventId: null, meetingUrl: null };
    }
    const body = (await res.json()) as { id?: string; htmlLink?: string };
    return { eventId: body.id ?? null, meetingUrl: body.htmlLink ?? null };
  } catch (error) {
    console.error("Calendar event create failed", error);
    return { eventId: null, meetingUrl: null };
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  const connectionAPIKey = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
  if (!connectionAPIKey) return;
  try {
    await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CALENDAR_CONNECTOR_ID,
      path: `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      init: { method: "DELETE" },
    });
  } catch (error) {
    console.error("Calendar event delete failed", error);
  }
}
