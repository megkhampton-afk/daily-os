import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Cross2Icon } from "@radix-ui/react-icons";
import { relTime } from "@/lib/capture";
import { getKey } from "@/lib/key";
import { useSetupMode } from "@/lib/setupMode";

export function Today() {
  const key = getKey();
  const setupMode = useSetupMode();
  const tasks = useQuery(api.capture.listTasks, { key });
  const events = useQuery(api.capture.listEvents, { key });
  const status = useQuery(api.oauth.status, { key });
  const toggle = useMutation(api.capture.toggleTask);
  const delEvent = useMutation(api.capture.deleteEvent);

  const open = (tasks ?? []).filter((t) => !t.done);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>To-do</CardTitle>
          <CardDescription>{tasks ? `${open.length} open` : "Loading..."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {tasks?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet. Capture something above.</p>
          )}
          {open.slice(0, 4).map((t) => (
            <div
              key={t._id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 animate-in fade-in slide-in-from-top-1"
            >
              <Checkbox checked={t.done} onCheckedChange={() => void toggle({ key, id: t._id })} />
              <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
              {t.due && (
                <Badge variant={t.due < Date.now() ? "destructive" : "outline"} className="shrink-0">
                  {relTime(t.due)}
                </Badge>
              )}
            </div>
          ))}
          <a
            href="#todos"
            className="block px-2 pt-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {open.length} open · View all →
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming events</CardTitle>
          <CardDescription>
            {status?.google ? (
              `Syncing automatically to ${status.google}'s Google Calendar`
            ) : setupMode ? (
              <>
                <a href="#setup" className="underline">
                  Connect Google
                </a>{" "}
                to sync events to your calendar automatically
              </>
            ) : (
              "What's coming up next"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {events?.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          {events?.map((e) => (
            <div
              key={e._id}
              className="group flex items-center gap-3 rounded-md border px-3 py-2 animate-in fade-in slide-in-from-top-1"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{e.title}</span>
                <span className="text-xs text-muted-foreground">{relTime(e.start)}</span>
              </div>
              <div className="ml-auto">
                {e.calendarSynced ? (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    On {e.calendarName ?? "Google Calendar"}
                  </Badge>
                ) : e.syncError ? (
                  <Badge variant="destructive" title={e.syncError}>Sync failed</Badge>
                ) : status?.google ? (
                  <Badge variant="outline">Syncing...</Badge>
                ) : (
                  <Badge variant="outline">Not synced</Badge>
                )}
              </div>
              <button
                className="p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                onClick={() => void delEvent({ key, id: e._id })}
              >
                <Cross2Icon />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
