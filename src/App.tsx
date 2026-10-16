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
  const res = useQuery(api.key.verify, { key });
  const createPasscode = useMutation(api.settings.createPasscode);

  if (res === undefined) return null;
  if (res.ok) return <>{children}</>;
  const creating = res.needsPasscode;

  async function submitPasscode() {
    if (creating) {
      try {
        await createPasscode({ passcode: draft });
      } catch (err) {
        toast.error((err as Error).message);
        return;
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
            <Input type="password" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit">{creating ? "Create" : "Unlock"}</Button>
          </form>
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
  const tab = TABS.includes(hash.slice(1)) ? hash.slice(1) : "today";

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
            <TabsTrigger value="setup">Setup</TabsTrigger>
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
