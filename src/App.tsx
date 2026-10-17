import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Setup } from "@/Setup";
import { Schedule } from "@/Schedule";

const TABS = ["today", "todos", "schedule", "assignments", "email", "setup"];
import { api } from "../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getKey, setKey } from "@/lib/key";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Capture } from "@/Capture";
import { Today } from "@/Today";
import { Todos } from "@/Todos";
import { Assignments } from "@/Assignments";
import { EmailTriage } from "@/EmailTriage";
import { DueSoon } from "@/DueSoon";
import { SetupSwitch } from "@/components/SetupSwitch";
import { errorMessage } from "@/lib/errors";
import { isSetupMode, setSetupMode, useSetupMode } from "@/lib/setupMode";

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

// Toast the connect/disconnect result carried in ?connect= after OAuth redirects.
function useConnectToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("connect");
    if (!msg) return;
    if (msg.startsWith("error")) toast.error(msg);
    else toast.success(msg);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, []);
}

function Gate({ children }: { children: React.ReactNode }) {
  const [key, setKeyState] = useState(getKey());
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const res = useQuery(api.key.verify, { key });
  const createPasscode = useMutation(api.settings.createPasscode);

  if (res === undefined) return null;
  if (res.ok) return <>{children}</>;
  const creating = res.needsPasscode;

  async function submitPasscode() {
    if (!draft.trim() || busy) return;
    if (creating) {
      setBusy(true);
      try {
        await createPasscode({ passcode: draft });
      } catch (err) {
        const msg = errorMessage(err);
        // Another tab (or an earlier run) already set one; the screen
        // switches to Unlock on its own once the query refreshes.
        toast.error(
          msg === "A passcode already exists" ? "This copy already has a passcode. Enter it to unlock." : msg,
        );
        setDraft("");
        return;
      } finally {
        setBusy(false);
      }
    }
    setKey(draft.trim());
    setKeyState(draft.trim());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-3 p-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <img src="/notebook.svg" alt="" className="size-6" /> Daily OS
          </h1>
          <p className="text-sm text-muted-foreground">
            {creating
              ? "Welcome! Create a passcode. Anyone who opens this site needs it to see your data."
              : key
                ? "That passcode didn't match."
                : "Enter your passcode."}
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPasscode();
            }}
          >
            <Input
              type="password"
              autoFocus
              autoComplete={creating ? "new-password" : "current-password"}
              placeholder={creating ? "At least 4 characters" : "Passcode"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" disabled={busy || !draft.trim()}>
              {creating ? "Create" : "Unlock"}
            </Button>
          </form>
          {!creating && (
            <p className="text-xs text-muted-foreground">
              Forgot it? In the project folder run <code className="rounded bg-muted px-1">npx convex run settings:resetPasscode</code>,
              then reload this page to create a new one.
            </p>
          )}
        </CardContent>
      </Card>
      <Toaster richColors position="top-center" />
    </div>
  );
}

export default function App() {
  return (
    <Gate>
      <Main />
    </Gate>
  );
}

function Main() {
  useConnectToast();
  const hash = useHash();
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const name = import.meta.env.VITE_OWNER_NAME as string | undefined;
  const setupMode = useSetupMode();
  const requested = TABS.includes(hash.slice(1)) ? hash.slice(1) : "today";
  const tab = requested === "setup" && !setupMode ? "today" : requested;

  // Following any "Set up" link (or opening #setup directly) turns setup mode on.
  useEffect(() => {
    const on = () => {
      if (window.location.hash === "#setup" && !isSetupMode()) setSetupMode(true);
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  function toggleSetup(next: boolean) {
    if (!next && tab === "setup") window.location.hash = "today";
    setSetupMode(next);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-6xl space-y-6 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting}
              {name ? `, ${name}` : ""}
            </h1>
            <p className="text-muted-foreground">
              {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · Everything in one place.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SetupSwitch on={setupMode} onChange={toggleSetup} />
            <ThemeToggle />
          </div>
        </header>
        <Tabs value={tab} onValueChange={(v) => (window.location.hash = v)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="todos">To-dos</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="email">Email triage</TabsTrigger>
            {setupMode && <TabsTrigger value="setup">Setup</TabsTrigger>}
          </TabsList>
          <TabsContent value="todos">
            <Todos />
          </TabsContent>
          <TabsContent value="schedule">
            <Schedule />
          </TabsContent>
          <TabsContent value="setup">
            <Setup />
          </TabsContent>
          <TabsContent value="today" className="space-y-4">
            <DueSoon />
            <Capture compact />
            <Today />
          </TabsContent>
          <TabsContent value="assignments">
            <Assignments />
          </TabsContent>
          <TabsContent value="email">
            <EmailTriage />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
