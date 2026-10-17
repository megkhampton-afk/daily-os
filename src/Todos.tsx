import { errorMessage } from "@/lib/errors";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Cross2Icon } from "@radix-ui/react-icons";
import { relTime } from "@/lib/capture";
import { getKey } from "@/lib/key";
import { cn } from "@/lib/utils";

export function Todos() {
  const key = getKey();
  const tasks = useQuery(api.capture.listTasks, { key });
  const toggle = useMutation(api.capture.toggleTask);
  const delTask = useMutation(api.capture.deleteTask);
  const addManualTask = useMutation(api.capture.addManualTask);
  const clearCompletedTasks = useMutation(api.capture.clearCompletedTasks);

  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [clearing, setClearing] = useState(false);

  const open = (tasks ?? []).filter((t) => !t.done);
  const done = (tasks ?? []).filter((t) => t.done);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await addManualTask({ key, title: trimmed });
      setTitle("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not add that to-do."));
    } finally {
      setAdding(false);
    }
  }

  async function clearCompleted() {
    setClearing(true);
    try {
      await clearCompletedTasks({ key });
      toast.success("Cleared completed to-dos.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not clear completed to-dos."));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>To-dos</CardTitle>
          <CardDescription>
            Everything you captured, plus anything you add here. Check things off as you go.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={(e) => void submit(e)}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a to-do..."
            />
            <Button type="submit" disabled={!title.trim() || adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </form>

          {tasks === undefined ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Add one above, or capture from the Today tab.
            </p>
          ) : (
            <div className="space-y-1">
              {open.map((t) => (
                <div
                  key={t._id}
                  className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 animate-in fade-in slide-in-from-top-1"
                >
                  <Checkbox checked={t.done} onCheckedChange={() => void toggle({ key, id: t._id })} />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  {t.due && (
                    <Badge variant={t.due < Date.now() ? "destructive" : "outline"} className="ml-auto shrink-0">
                      {relTime(t.due)}
                    </Badge>
                  )}
                  <button
                    aria-label={`Delete ${t.title}`}
                    className={cn("p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100", !t.due && "ml-auto")}
                    onClick={() => void delTask({ key, id: t._id })}
                  >
                    <Cross2Icon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-1 border-t pt-4">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Completed ({done.length})
                </h3>
                <Button variant="ghost" size="sm" disabled={clearing} onClick={() => void clearCompleted()}>
                  {clearing ? "Clearing..." : "Clear completed"}
                </Button>
              </div>
              {done.map((t) => (
                <div
                  key={t._id}
                  className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 animate-in fade-in slide-in-from-top-1"
                >
                  <Checkbox checked={t.done} onCheckedChange={() => void toggle({ key, id: t._id })} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
                    {t.title}
                  </span>
                  <button
                    aria-label={`Delete ${t.title}`}
                    className="p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    onClick={() => void delTask({ key, id: t._id })}
                  >
                    <Cross2Icon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
