import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { api } from "../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { daysUntil, dueLabel } from "@/lib/due";
import { getKey } from "@/lib/key";
import { cn } from "@/lib/utils";
import { gradescopeUrl } from "@/lib/gradescope";

const WINDOW_DAYS = 7;

function headline(title: string, days: number) {
  if (days < 0) return `${title} is overdue. Knock it out first.`;
  if (days === 0) return `${title} is due today. Finish it first.`;
  if (days === 1) return `Work on ${title} now. It's due tomorrow.`;
  if (days <= 3) return `Start ${title} soon. It's due in ${days} days.`;
  return `Up next: ${title}, due in ${days} days.`;
}

function urgency(days: number) {
  if (days <= 1) return "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300";
  if (days <= 3) return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300";
  return "";
}

export function DueSoon() {
  const key = getKey();
  const [now] = useState(() => Date.now());
  const assignments = useQuery(api.assignments.list, { key, now });
  const courses = useQuery(api.courses.list, { key });

  const soon = useMemo(
    () =>
      (assignments ?? [])
        .filter((a) => !a.done && a.due !== undefined && daysUntil(a.due) <= WINDOW_DAYS)
        .map((a) => ({ ...a, days: daysUntil(a.due!) })),
    [assignments],
  );

  if (assignments === undefined) return null;

  const [next, ...rest] = soon;

  return (
    <Card className={cn("border-l-4", next && next.days <= 1 ? "border-l-red-500" : "border-l-primary")}>
      <CardHeader className="pb-3">
        <CardDescription>Due soon</CardDescription>
        <CardTitle className="text-xl leading-snug">
          {next ? headline(next.title, next.days) : "Nothing due this week. Nice work."}
        </CardTitle>
        {next && (
          <p className="text-sm text-muted-foreground">
            {next.course} · {dueLabel(next.due)}
          </p>
        )}
      </CardHeader>
      {next && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {next.url && (
              <Button size="sm" variant="outline" asChild>
                <a href={next.url} target="_blank" rel="noreferrer">
                  Open assignment
                </a>
              </Button>
            )}
              <Button size="sm" asChild>
                <a href={gradescopeUrl(next, courses ?? []) ?? "https://www.gradescope.com/"} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="mr-1.5" /> {gradescopeUrl(next, courses ?? []) ? "Turn in on Gradescope" : "Open Gradescope"}
                </a>
              </Button>
          </div>
          {rest.length > 0 && (
            <ul className="space-y-1 border-t pt-3">
              {rest.slice(0, 4).map((a) => (
                <li key={a._id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {a.title}
                      </a>
                    ) : (
                      a.title
                    )}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {a.course}
                  </Badge>
                  <Badge variant="outline" className={cn("shrink-0", urgency(a.days))}>
                    {dueLabel(a.due)}
                  </Badge>
                </li>
              ))}
              {rest.length > 4 && (
                <li>
                  <a href="#assignments" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                    {rest.length - 4} more this week · View all →
                  </a>
                </li>
              )}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
