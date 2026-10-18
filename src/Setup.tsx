import { errorMessage } from "@/lib/errors";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "@radix-ui/react-icons";
import { getKey } from "@/lib/key";
import { FolderPicker } from "@/FolderPicker";

type Name =
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "MS_CLIENT_ID"
  | "MS_CLIENT_SECRET"
  | "CANVAS_TOKEN"
  | "CANVAS_URL"
  | "APPLE_ID"
  | "APPLE_APP_PASSWORD";

function AppleCard({ isSet }: { isSet: Record<string, boolean> }) {
  const key = getKey();
  const status = useQuery(api.oauth.status, { key });
  const test = useAction(api.apple.testConnection);
  const save = useMutation(api.settings.save);
  const [testing, setTesting] = useState(false);
  const [calendars, setCalendars] = useState<string[] | null>(null);
  const ready = isSet.APPLE_ID && isSet.APPLE_APP_PASSWORD;

  async function runTest() {
    setTesting(true);
    try {
      const r = await test({ key });
      if (r.ok) {
        setCalendars(r.calendars);
        toast.success(`Connected. Found ${r.calendars.length} calendar${r.calendars.length === 1 ? "" : "s"}.`);
      } else {
        setCalendars(null);
        toast.error(r.error ?? "Could not reach iCloud.");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Apple Calendar (iCloud) {ready && <Badge className="bg-green-600 hover:bg-green-600">Saved</Badge>}
        </CardTitle>
        <CardDescription>
          About 2 minutes. No developer app needed. Captured events land on the iCloud calendar named after the course,
          and your Schedule shows every iCloud calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          <Step n={1}>
            Open <A href="https://account.apple.com/account/manage">your Apple Account</A> and go to{" "}
            <b>Sign-In and Security</b>, then <b>App-Specific Passwords</b>.
          </Step>
          <Step n={2}>
            Create one named <b>Daily OS</b> and copy it. (Your normal Apple password won't work here, and you can revoke
            this one any time.)
          </Step>
          <Step n={3}>Paste your Apple ID email and the app-specific password below, save, then test.</Step>
        </ol>
        <Fields
          isSet={isSet}
          fields={[
            { name: "APPLE_ID", label: "Apple ID email", placeholder: "you@icloud.com" },
            { name: "APPLE_APP_PASSWORD", label: "App-specific password", secret: true, placeholder: "xxxx-xxxx-xxxx-xxxx" },
          ]}
        />
        {ready && (
          <Button variant="outline" disabled={testing} onClick={() => void runTest()}>
            {testing ? "Testing..." : "Test connection"}
          </Button>
        )}
        {calendars && (
          <p className="text-sm text-muted-foreground">
            Calendars: {calendars.length ? calendars.join(", ") : "none found"}
          </p>
        )}
        {ready && status?.google && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Capture new events to</p>
            <div className="flex gap-2">
              {(["google", "apple"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={status.captureCalendar === p ? "default" : "outline"}
                  onClick={() =>
                    void save({ key, values: [{ name: "CAPTURE_CALENDAR", value: p }] }).catch((e) =>
                      toast.error(errorMessage(e)),
                    )
                  }
                >
                  {p === "google" ? "Google Calendar" : "Apple Calendar"}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Copy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
      <span className="truncate">{value}</span>
      <button
        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="space-y-1.5 leading-6">{children}</div>
    </li>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
      {children}
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}

function Fields({
  fields,
  isSet,
}: {
  fields: { name: Name; label: string; secret?: boolean; placeholder?: string }[];
  isSet: Record<string, boolean>;
}) {
  const key = getKey();
  const save = useMutation(api.settings.save);
  const [values, setValues] = useState<Partial<Record<Name, string>>>({});
  const [saving, setSaving] = useState(false);
  const dirty = Object.values(values).some((v) => v && v.trim());

  async function submit() {
    setSaving(true);
    try {
      await save({
        key,
        values: Object.entries(values)
          .filter(([, v]) => v && v.trim())
          .map(([name, value]) => ({ name: name as Name, value })),
      });
      setValues({});
      toast.success("Saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <label key={f.name} className="block space-y-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            {f.label}
            {isSet[f.name] && <Badge variant="secondary" className="h-5">Saved</Badge>}
          </span>
          <Input
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={isSet[f.name] ? "Saved. Paste a new value to replace it." : f.placeholder}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
          />
        </label>
      ))}
      <Button disabled={!dirty || saving} onClick={() => void submit()}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}

function CourseLinksCard() {
  const key = getKey();
  const courses = useQuery(api.courses.list, { key });
  const save = useMutation(api.courses.save);
  const remove = useMutation(api.courses.remove);
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!code.trim()) return;
    setSaving(true);
    try {
      await save({ key, code, gradescopeUrl: link });
      setCode("");
      setLink("");
      toast.success("Course link saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course links (Gradescope)</CardTitle>
        <CardDescription>
          Link each course code to its Gradescope page and its assignments get a one-tap Turn in
          button.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {courses === undefined ? (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No courses yet. Use the exact course code shown on assignments (for example 6.390).
          </p>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c._id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Badge variant="outline" className="shrink-0">{c.code}</Badge>
                {c.gradescopeUrl ? (
                  <a
                    href={c.gradescopeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-xs underline underline-offset-2"
                  >
                    {c.gradescopeUrl}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">No link yet</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => void remove({ key, id: c._id }).catch(() => toast.error("Couldn't remove that course."))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="sm:w-32"
            placeholder="6.390"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            className="flex-1"
            placeholder="https://www.gradescope.com/courses/â€¦"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
        <Button disabled={!code.trim() || saving} onClick={() => void submit()}>
          {saving ? "Saving..." : "Save course link"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function Setup() {
  const key = getKey();
  const s = useQuery(api.settings.status, { key });
  if (!s) return null;
  const googleReady = s.isSet.GOOGLE_CLIENT_ID && s.isSet.GOOGLE_CLIENT_SECRET;
  const msReady = s.isSet.MS_CLIENT_ID && s.isSet.MS_CLIENT_SECRET;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <FolderPicker />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Canvas {s.isSet.CANVAS_TOKEN && <Badge className="bg-green-600 hover:bg-green-600">Ready</Badge>}
          </CardTitle>
          <CardDescription>About 1 minute. Pulls your upcoming, unsubmitted assignments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            <Step n={1}>Enter your school's Canvas address below (for example https://canvas.instructure.com).</Step>
            <Step n={2}>
              Open <A href={`${s.canvasUrl}/profile/settings`}>Canvas settings</A>, scroll to Approved Integrations, and click{" "}
              <b>New Access Token</b>.
            </Step>
            <Step n={3}>Paste the token below and save.</Step>
          </ol>
          <Fields
            isSet={s.isSet}
            fields={[
              { name: "CANVAS_URL", label: "Canvas address", placeholder: s.canvasUrl },
              { name: "CANVAS_TOKEN", label: "Access token", secret: true },
            ]}
          />
        </CardContent>
      </Card>

      <CourseLinksCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Google (Calendar + Gmail){" "}
            {googleReady && <Badge className="bg-green-600 hover:bg-green-600">Ready to connect</Badge>}
          </CardTitle>
          <CardDescription>
            About 5 minutes, one time. You create a private Google app that only you use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            <Step n={1}>
              <A href="https://console.cloud.google.com/projectcreate">Create a Google Cloud project</A> (or pick an existing one).
            </Step>
            <Step n={2}>
              Enable the <A href="https://console.cloud.google.com/apis/library/gmail.googleapis.com">Gmail API</A> and the{" "}
              <A href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com">Google Calendar API</A>.
            </Step>
            <Step n={3}>
              Open the <A href="https://console.cloud.google.com/auth/overview">consent screen</A>, click Get started, and
              choose <b>External</b>. Then go to <b>Audience</b>, find <b>Test users</b>, and add your own Gmail address.
            </Step>
            <Step n={4}>
              <A href="https://console.cloud.google.com/auth/clients/create">Create a client</A>: type <b>Web application</b>.
              Under Authorized redirect URIs, add:
              <Copy value={s.googleRedirect} />
            </Step>
            <Step n={5}>Paste the Client ID and Client secret below and save.</Step>
          </ol>
          <Fields
            isSet={s.isSet}
            fields={[
              { name: "GOOGLE_CLIENT_ID", label: "Client ID", placeholder: "...apps.googleusercontent.com" },
              { name: "GOOGLE_CLIENT_SECRET", label: "Client secret", secret: true, placeholder: "GOCSPX-..." },
            ]}
          />
          {googleReady && (
            <Button asChild variant="outline">
              <a href="#email">Go connect Google</a>
            </Button>
          )}
        </CardContent>
      </Card>

      <AppleCard isSet={s.isSet} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            School email (Microsoft 365){" "}
            {msReady && <Badge className="bg-green-600 hover:bg-green-600">Ready to connect</Badge>}
          </CardTitle>
          <CardDescription>
            Optional. Some schools block personal apps; if you see "Need admin approval", forward school mail to Gmail instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            <Step n={1}>
              Open <A href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade">App registrations</A>{" "}
              and click <b>New registration</b>.
            </Step>
            <Step n={2}>
              Choose <b>Accounts in any organizational directory and personal Microsoft accounts</b>. Set the redirect URI
              platform to <b>Web</b> with:
              <Copy value={s.microsoftRedirect} />
            </Step>
            <Step n={3}>
              Under <b>API permissions</b>, add Microsoft Graph delegated permissions <code>Mail.ReadWrite</code>,{" "}
              <code>offline_access</code>, and <code>User.Read</code>.
            </Step>
            <Step n={4}>
              Under <b>Certificates &amp; secrets</b>, create a client secret and copy its <b>Value</b>.
            </Step>
            <Step n={5}>Paste the Application (client) ID and the secret value below.</Step>
          </ol>
          <Fields
            isSet={s.isSet}
            fields={[
              { name: "MS_CLIENT_ID", label: "Application (client) ID" },
              { name: "MS_CLIENT_SECRET", label: "Client secret value", secret: true },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
