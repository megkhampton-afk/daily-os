import { errorMessage } from "@/lib/errors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReloadIcon } from "@radix-ui/react-icons";
import { getKey } from "@/lib/key";
import { cn } from "@/lib/utils";

type Ev = {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  calendar: string;
  color?: string;
  location?: string;
};

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const MIN_FREE_MIN = 30;

function dayBounds(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const start = d.getTime();
  const e = new Date(d);
  e.setDate(e.getDate() + 1);
  return { start, end: e.getTime(), date: d };
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const ymdUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const fmt = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(":00", "");

function duration(ms: number) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

function freeBlocks(events: Ev[], dayStart: number) {
  const open = dayStart + DAY_START_HOUR * 3600_000;
  const close = dayStart + DAY_END_HOUR * 3600_000;
  const busy = events
    .filter((e) => !e.allDay)
    .map((e) => [Math.max(e.start, open), Math.min(e.end, close)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const free: { start: number; end: number }[] = [];
  let cursor = open;
  for (const [s, e] of busy) {
    if (s - cursor >= MIN_FREE_MIN * 60000) free.push({ start: cursor, end: s });
    cursor = Math.max(cursor, e);
  }
  if (close - cursor >= MIN_FREE_MIN * 60000) free.push({ start: cursor, end: close });
  return free;
}

export function Schedule() {
  const key = getKey();
  const fetchRange = useAction(api.schedule.range);
  const [offset, setOffset] = useState(1);
  const [data, setData] = useState<{ connected: boolean; events: Ev[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = dayBounds(0);
      const b = dayBounds(3);
      setData(await fetchRange({ key, start: a.start, end: b.start }));
    } catch (e) {
      setData({ connected: true, events: [], error: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, [fetchRange, key]);

  useEffect(() => {
    void load();
  }, [load]);

  const day = dayBounds(offset);
  const { allDay, timed, free } = useMemo(() => {
    const events = data?.events ?? [];
    const ymd = ymdLocal(day.date);
    const allDay = events.filter((e) => e.allDay && ymdUtc(e.start) <= ymd && ymd < ymdUtc(e.end));
    const timed = events.filter((e) => !e.allDay && e.end > day.start && e.start < day.end);
    return { allDay, timed, free: freeBlocks(timed, day.start) };
    // day is derived from offset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, offset]);

  const totalFree = free.reduce((s, f) => s + (f.end - f.start), 0);
  const rows = [
    ...timed.map((e) => ({ kind: "event" as const, start: e.start, e })),
    ...free.map((f) => ({ kind: "free" as const, start: f.start, f })),
  ].sort((a, b) => a.start - b.start);

  const labels = [0, 1, 2].map((o) =>
    o === 0 ? "Today" : o === 1 ? "Tomorrow" : dayBounds(o).date.toLocaleDateString([], { weekday: "long" }),
  );

  const open = day.start + DAY_START_HOUR * 3600_000;
  const span = (DAY_END_HOUR - DAY_START_HOUR) * 3600_000;
  const pct = (ms: number) => `${Math.min(100, Math.max(0, ((ms - open) / span) * 100))}%`;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{day.date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</CardTitle>
            <CardDescription>
              {data?.connected === false
                ? "Connect Google on the Email triage tab to see your calendar."
                : `${timed.length} event${timed.length === 1 ? "" : "s"} Â· ${duration(totalFree)} free between ${DAY_START_HOUR} am and ${DAY_END_HOUR - 12} pm`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {labels.map((l, i) => (
              <Button key={l} size="sm" variant={offset === i ? "default" : "ghost"} onClick={() => setOffset(i)}>
                {l}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <ReloadIcon className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
        {data?.connected !== false && (
          <div>
            <div className="relative h-6 overflow-hidden rounded-md bg-emerald-500/15">
              {timed.map((e) => (
                <div
                  key={e.id}
                  className="absolute inset-y-0 rounded-sm opacity-90"
                  style={{
                    left: pct(e.start),
                    width: `calc(${pct(e.end)} - ${pct(e.start)})`,
                    background: e.color ?? "hsl(var(--primary))",
                  }}
                  title={`${e.title} ${fmt(e.start)}â€“${fmt(e.end)}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {[8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                <span key={h}>{h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}</span>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {data?.error && <p className="text-sm text-destructive">{data.error}</p>}
        {!data && <p className="text-sm text-muted-foreground">Loading your calendar...</p>}
        {allDay.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm">
            <Badge variant="outline">All day</Badge>
            <span className="font-medium">{e.title}</span>
            <span className="ml-auto text-xs text-muted-foreground">{e.calendar}</span>
          </div>
        ))}
        {data?.connected && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing scheduled. The whole day is free.</p>
        )}
        {rows.map((r) =>
          r.kind === "event" ? (
            <div key={r.e.id} className="flex gap-3 rounded-md border px-3 py-2">
              <div className="w-1 shrink-0 rounded-full" style={{ background: r.e.color ?? "hsl(var(--primary))" }} />
              <div className="w-24 shrink-0 text-xs leading-5 text-muted-foreground">
                {fmt(r.e.start)}â€“{fmt(r.e.end)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.e.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.e.calendar}
                  {r.e.location ? ` Â· ${r.e.location}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div
              key={`free-${r.f.start}`}
              className={cn(
                "flex gap-3 rounded-md bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400",
              )}
            >
              <div className="w-1 shrink-0" />
              <div className="w-24 shrink-0 text-xs leading-5">
                {fmt(r.f.start)}â€“{fmt(r.f.end)}
              </div>
              <p className="text-sm font-medium">Free Â· {duration(r.f.end - r.f.start)}</p>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}
