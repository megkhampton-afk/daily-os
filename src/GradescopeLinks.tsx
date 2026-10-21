import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getKey } from "@/lib/key";
import { errorMessage } from "@/lib/errors";

export function GradescopeLinks({ courseOptions = [] }: { courseOptions?: string[] }) {
  const key = getKey();
  const listId = useId();
  const courses = useQuery(api.courses.list, { key });
  const save = useMutation(api.courses.save);
  const remove = useMutation(api.courses.remove);
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!code.trim() || !link.trim() || saving) return;
    setSaving(true);
    try {
      await save({ key, code, gradescopeUrl: link });
      setCode("");
      setLink("");
      toast.success("Gradescope course link saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gradescope course links</CardTitle>
        <CardDescription>
          Open your course on Gradescope and paste its address here. Its assignments will get a
          “Turn in on Gradescope” button. You submit your work on Gradescope, not in Daily OS.
        </CardDescription>
        <Button size="sm" variant="outline" className="self-start" asChild>
          <a href="https://www.gradescope.com/" target="_blank" rel="noreferrer">Open Gradescope</a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {courses === undefined ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <ul className="space-y-2">
            {courses.map((course) => (
              <li key={course._id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                <Badge variant="outline">{course.code}</Badge>
                {course.gradescopeUrl && (
                  <a href={course.gradescopeUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                    Open course
                  </a>
                )}
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => {
                  setCode(course.code);
                  setLink(course.gradescopeUrl ?? "");
                }}>Edit link</Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => {
                  void remove({ key, id: course._id }).catch(() => toast.error("Couldn't remove that course link."));
                }}>Remove link</Button>
              </li>
            ))}
          </ul>
        )}
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label className="block space-y-1 text-sm">
            <span>Course name or code (as shown on your assignment)</span>
            <Input list={listId} value={code} disabled={saving} placeholder="Choose a course or type its code" onChange={(event) => setCode(event.target.value)} />
            <datalist id={listId}>{courseOptions.map((option) => <option key={option} value={option} />)}</datalist>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Gradescope course URL</span>
            <Input type="url" value={link} disabled={saving} placeholder="https://www.gradescope.com/courses/..." onChange={(event) => setLink(event.target.value)} />
          </label>
          <Button type="submit" disabled={!code.trim() || !link.trim() || saving}>
            {saving ? "Saving..." : "Save course link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
