import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getKey } from "@/lib/key";
import { errorMessage } from "@/lib/errors";

export function Notes() {
  const key = getKey();
  const notes = useQuery(api.notes.list, { key });
  const save = useMutation(api.notes.save);
  const [id, setId] = useState<Id<"notes">>();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function open(note?: Doc<"notes">) {
    if (dirty && !window.confirm("Discard the unsaved changes to this note?")) return;
    setId(note?._id);
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setDirty(false);
  }

  async function saveNote() {
    if (saving || !title.trim()) return;
    setSaving(true);
    try {
      const savedId = await save({ key, id, title, body });
      setId(savedId);
      setTitle(title.trim());
      setDirty(false);
      toast.success("Note saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Notes</CardTitle>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => open()}>New note</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {notes === undefined ? <p className="text-sm text-muted-foreground">Loading notes...</p> : (
            <>
              {notes.length === 0 && <p className="text-sm text-muted-foreground">Your saved notes will appear here.</p>}
              {notes.map((note) => (
                <button
                  key={note._id}
                  type="button"
                  disabled={saving}
                  onClick={() => open(note)}
                  aria-pressed={id === note._id}
                  className={`w-full rounded-md border p-3 text-left hover:bg-muted ${id === note._id ? "border-primary bg-muted" : ""}`}
                >
                  <span className="block truncate text-sm font-medium">{note.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(note.updatedAt).toLocaleDateString()}</span>
                </button>
              ))}
              {notes.length === 100 && <p className="text-xs text-muted-foreground">Showing your 100 most recently edited notes.</p>}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{id ? "Edit note" : "New note"}</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveNote(); }}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Title</span>
              <Input
                value={title}
                placeholder="Give your note a title"
                maxLength={200}
                disabled={saving}
                onChange={(event) => { setTitle(event.target.value); setDirty(true); }}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Note</span>
              <Textarea
                value={body}
                placeholder="Write whatever you want to keep..."
                className="min-h-80"
                maxLength={100_000}
                disabled={saving}
                onChange={(event) => { setBody(event.target.value); setDirty(true); }}
              />
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving || !dirty || !title.trim()}>{saving ? "Saving..." : "Save note"}</Button>
              <span role="status" className="text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : id ? "Saved across your devices" : "Add a title and save your note"}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
