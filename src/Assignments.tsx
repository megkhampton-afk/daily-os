import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DownloadIcon, ExternalLinkIcon } from "@radix-ui/react-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getKey } from "@/lib/key";
import { findMissing, parseSyllabus, type SyllabusItem } from "@/lib/syllabus";
import { calendarDay, dueLabel } from "@/lib/due";
import { errorMessage } from "@/lib/errors";
import { useSetupMode } from "@/lib/setupMode";

type PreviewItem = SyllabusItem & { missing: boolean };

function sampleSyllabus() {
  const dateAfter = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return `• Problem Set 3: Linear models, due ${dateAfter(7)}
• Reading response: Generalization and overfitting, due ${dateAfter(14)}
• Lab 2: Gradient descent, due ${dateAfter(21)}
• Quiz 1: Probability review, due ${dateAfter(30)}
• Project proposal: Learning from data, due ${dateAfter(39)}
• Midterm exam, due ${dateAfter(50)}`;
}

export function Assignments() {
  const key = getKey();
  const setupMode = useSetupMode();
  const [now] = useState(() => Date.now());
  const assignments = useQuery(api.assignments.list, { key, now });
  const courses = useQuery(api.courses.list, { key });
  const toggleAssignment = useMutation(api.assignments.toggle);
  const addFromSyllabus = useMutation(api.assignments.addFromSyllabus);
  const syncCanvas = useAction(api.assignments.syncCanvas);

  const [syncing, setSyncing] = useState(false);
  const [course, setCourse] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [adding, setAdding] = useState(false);

  const buckets = useMemo(() => {
    const items = assignments ?? [];
    const result = {
      overdue: [] as typeof items,
      thisWeek: [] as typeof items,
      later: [] as typeof items,
      noDate: [] as typeof items,
      completed: [] as typeof items,
    };
    const today = calendarDay(new Date());

    for (const item of items) {
      if (item.done) {
        result.completed.push(item);
        continue;
      }
      if (item.due === undefined) result.noDate.push(item);
      else {
        const days = calendarDay(item.due) - today;
        if (days < 0) result.overdue.push(item);
        else if (days <= 7) result.thisWeek.push(item);
        else result.later.push(item);
      }
    }

    return [
      { key: "overdue", title: "Overdue", items: result.overdue },
      { key: "thisWeek", title: "This week", items: result.thisWeek },
      { key: "later", title: "Later", items: result.later },
      { key: "noDate", title: "No date", items: result.noDate },
      { key: "completed", title: "Completed", items: result.completed },
    ];
  }, [assignments]);

  const canvasAssignments = useMemo(
    () => (assignments ?? []).filter((item) => item.source === "canvas"),
    [assignments],
  );

  const courseMap = useMemo(
    () => new Map((courses ?? []).map((c) => [c.code, c])),
    [courses],
  );

  const unlinkedCourses = useMemo(() => {
    if (assignments === undefined) return [];
    const linked = new Set(
      (courses ?? []).filter((c) => c.gradescopeUrl).map((c) => c.code),
    );
    return [...new Set(assignments.map((a) => a.course))].filter(
      (code) => !linked.has(code),
    );
  }, [assignments, courses]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncCanvas({ key });
      if (result.error) {
        toast.error(`${result.error}. Add your Canvas token on the Setup tab.`);
      } else {
        toast.success(`Synced ${result.synced} assignments from Canvas.`);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Canvas sync failed."));
    } finally {
      setSyncing(false);
    }
  }

  function handleFind() {
    const parsed = parseSyllabus(syllabusText);
    const missingItems = findMissing(parsed, canvasAssignments, course.trim());
    const missing = new Set(missingItems);
    setPreview(parsed.map((item) => ({ ...item, missing: missing.has(item) })));
  }

  async function handleAddMissing() {
    if (!preview || !course.trim()) return;
    const missingItems = preview.filter((item) => item.missing);
    if (missingItems.length === 0) return;

    setAdding(true);
    try {
      await addFromSyllabus({
        key,
        course: course.trim(),
        items: missingItems.map(({ title, due }) =>
          due === undefined ? { title } : { title, due },
        ),
      });
      toast.success(
        `Added ${missingItems.length} assignment${missingItems.length === 1 ? "" : "s"} from the syllabus.`,
      );
      setPreview(null);
    } catch (error) {
      toast.error(errorMessage(error, "Could not add assignments."));
    } finally {
      setAdding(false);
    }
  }

  function trySample() {
    setCourse("6.390");
    setSyllabusText(sampleSyllabus());
    setPreview(null);
  }

  const missingCount = preview?.filter((item) => item.missing).length ?? 0;

  return (
    <section className={setupMode ? "grid gap-6 lg:grid-cols-2" : "mx-auto max-w-3xl"}>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Keep track of what’s due across your courses.
            </CardDescription>
            {setupMode && unlinkedCourses.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Add{" "}
                <a className="underline underline-offset-2" href="#setup">
                  Gradescope links
                </a>{" "}
                for {unlinkedCourses.slice(0, 3).join(", ")}
                {unlinkedCourses.length > 3 ? "…" : ""} to get one-tap Turn in
                buttons.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSync()}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync Canvas"}
          </Button>
        </CardHeader>
        <CardContent>
          {assignments === undefined ? (
            <p className="py-6 text-sm text-muted-foreground">
              Loading assignments…
            </p>
          ) : assignments.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No assignments yet. Sync Canvas or catch assignments from a
              syllabus.
            </p>
          ) : (
            <div className="space-y-6">
              {buckets.map((bucket) => (
                <section key={bucket.key}>
                  <div className="mb-2 flex items-center justify-between border-b pb-2">
                    <h4 className="text-sm font-medium">{bucket.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {bucket.items.length}
                    </span>
                  </div>
                  {bucket.items.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">
                      Nothing here
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {bucket.items.map((item) => {
                        const turnInUrl =
                          item.gradescopeUrl ??
                          courseMap.get(item.course)?.gradescopeUrl;
                        return (
                        <li
                          key={item._id}
                          className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={item.done}
                            aria-label={`Mark ${item.title} ${item.done ? "incomplete" : "complete"}`}
                            onCheckedChange={() => {
                              void toggleAssignment({ key, id: item._id }).catch(
                                () => toast.error("Could not update assignment."),
                              );
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`text-sm font-medium hover:underline ${item.done ? "text-muted-foreground line-through" : ""}`}
                                >
                                  {item.title}
                                </a>
                              ) : (
                                <span
                                  className={`text-sm font-medium ${item.done ? "text-muted-foreground line-through" : ""}`}
                                >
                                  {item.title}
                                </span>
                              )}
                              <Badge variant="outline">{item.course}</Badge>
                              {item.source === "syllabus" && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                                >
                                  Caught from syllabus
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {dueLabel(item.due)}
                            </p>
                            {(item.url || turnInUrl) && (
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {item.url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-10 px-4 sm:h-8 sm:px-3"
                                    asChild
                                  >
                                    <a href={item.url} target="_blank" rel="noreferrer">
                                      <DownloadIcon className="mr-1.5" /> Download
                                    </a>
                                  </Button>
                                )}
                                {turnInUrl && (
                                  <Button
                                    size="sm"
                                    className="h-10 px-4 sm:h-8 sm:px-3"
                                    asChild
                                  >
                                    <a href={turnInUrl} target="_blank" rel="noreferrer">
                                      <ExternalLinkIcon className="mr-1.5" /> Turn in
                                    </a>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {setupMode && (
      <Card>
        <CardHeader>
          <CardTitle>Syllabus catcher</CardTitle>
          <CardDescription>
            Find deadlines in a syllabus and compare them with Canvas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="syllabus-course" className="text-sm font-medium">
              Course code
            </label>
            <Input
              id="syllabus-course"
              placeholder="e.g. 6.390"
              value={course}
              onChange={(event) => {
                setCourse(event.target.value);
                setPreview(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="syllabus-text" className="text-sm font-medium">
                Syllabus text
              </label>
              <Button variant="ghost" size="sm" onClick={trySample}>
                Try sample
              </Button>
            </div>
            <Textarea
              id="syllabus-text"
              rows={9}
              placeholder="Paste the schedule or assignment section from your syllabus…"
              value={syllabusText}
              onChange={(event) => {
                setSyllabusText(event.target.value);
                setPreview(null);
              }}
            />
          </div>
          <Button
            onClick={handleFind}
            disabled={
              !course.trim() ||
              !syllabusText.trim() ||
              assignments === undefined
            }
          >
            Find assignments
          </Button>

          {preview !== null && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <h4 className="text-sm font-medium">
                  {preview.length} item{preview.length === 1 ? "" : "s"} found
                </h4>
                <p className="text-xs text-muted-foreground">
                  {missingCount} not currently on Canvas
                </p>
              </div>
              {preview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No deliverables found. Try pasting lines with assignment
                  keywords and dates.
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {preview.map((item, index) => (
                    <li
                      key={`${item.title}-${item.due ?? "no-date"}-${index}`}
                      className={`flex items-start justify-between gap-3 rounded-md border p-3 ${
                        item.missing
                          ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5"
                          : "border-border bg-muted/30 opacity-70"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dueLabel(item.due)}
                        </p>
                      </div>
                      <Badge
                        variant={item.missing ? "outline" : "secondary"}
                        className={
                          item.missing
                            ? "shrink-0 border-amber-400 text-amber-900 dark:text-amber-200"
                            : "shrink-0"
                        }
                      >
                        {item.missing ? "Not on Canvas" : "Already on Canvas"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                onClick={() => void handleAddMissing()}
                disabled={missingCount === 0 || adding}
              >
                {adding
                  ? "Adding…"
                  : `Add ${missingCount} missing`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </section>
  );
}
