import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, CheckCircledIcon, PaperPlaneIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { parseCapture, relTime } from "@/lib/capture";
import { getKey } from "@/lib/key";
import { useSetupMode } from "@/lib/setupMode";

const EXAMPLES = [
  "dinner with Sam thursday 7pm, finish 6.390 pset by friday",
  "call the career center tomorrow at 2pm and buy groceries",
  "email my advisor about an extension, robotics club build night wed 8pm",
];

export function Capture({ compact = false }: { compact?: boolean }) {
  const setupMode = useSetupMode();
  const [text, setText] = useState("");
  const addItems = useMutation(api.capture.addItems);
  const preview = useMemo(() => parseCapture(text), [text]);
  const count = preview.tasks.length + preview.events.length;

  async function submit() {
    if (!count) return;
    await addItems({ key: getKey(), ...preview });
    toast.success(
      `Added ${preview.tasks.length} task${preview.tasks.length === 1 ? "" : "s"} and ${preview.events.length} event${preview.events.length === 1 ? "" : "s"}`,
    );
    setText("");
  }

  return (
    <Card className={compact ? "" : "mx-auto w-full max-w-lg"}>
      <CardHeader>
        <CardTitle>Quick capture</CardTitle>
        <CardDescription>
          Type it like a text. Anything with a time goes straight onto your calendar. Everything else goes on your to-do list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          autoFocus={!compact}
          rows={compact ? 3 : 5}
          placeholder="dinner with Sam thursday 7pm, finish pset by friday"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          }}
          className="text-base"
        />
        {setupMode && !text && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setText(ex)}
                className="rounded-full border px-3 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {count > 0 && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            {preview.events.map((e, i) => (
              <div key={`e${i}`} className="flex items-center gap-2">
                <CalendarIcon className="shrink-0 text-blue-500" />
                <span className="font-medium">{e.title}</span>
                <Badge variant="secondary" className="ml-auto shrink-0">{relTime(e.start)}</Badge>
              </div>
            ))}
            {preview.tasks.map((t, i) => (
              <div key={`t${i}`} className="flex items-center gap-2">
                <CheckCircledIcon className="shrink-0 text-green-600" />
                <span className="font-medium">{t.title}</span>
                {t.due && (
                  <Badge variant="outline" className="ml-auto shrink-0">due {relTime(t.due)}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
        <Button className="w-full" size="lg" disabled={!count} onClick={() => void submit()}>
          <PaperPlaneIcon className="mr-2" /> Add {count || ""} item{count === 1 ? "" : "s"}
        </Button>
      </CardContent>
    </Card>
  );
}
