import { errorMessage } from "@/lib/errors";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getKey } from "@/lib/key";

export function Connections() {
  const key = getKey();
  const status = useQuery(api.oauth.status, { key });
  const startLogin = useMutation(api.oauth.startLogin);
  const disconnect = useMutation(api.oauth.disconnect);
  const sync = useAction(api.emails.sync);
  const [syncing, setSyncing] = useState(false);

  async function connect(provider: "google" | "microsoft") {
    try {
      window.location.href = await startLogin({
        key,
        provider,
        returnTo: window.location.origin + window.location.pathname,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function runSync() {
    setSyncing(true);
    try {
      const r = await sync({ key });
      const parts = [
        r.google && `Gmail: ${r.google}`,
        r.microsoft && `Outlook: ${r.microsoft}`,
      ].filter(Boolean);
      if (!parts.length) toast.info("Connect an account first");
      else if (parts.some((p) => String(p).includes("error"))) toast.error(parts.join(" Â· "));
      else toast.success(parts.join(" Â· "));
    } finally {
      setSyncing(false);
    }
  }

  const rows = [
    {
      id: "google" as const,
      name: "Google (Gmail + Calendar)",
      account: status?.google,
      configured: status?.googleConfigured,
    },
    {
      id: "microsoft" as const,
      name: "School or work email (Microsoft 365)",
      account: status?.microsoft,
      configured: status?.microsoftConfigured,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>Sorting here applies real labels and folders in your mailbox.</CardDescription>
        </div>
        <Button
          size="sm"
          disabled={syncing || !(status?.google || status?.microsoft)}
          onClick={() => void runSync()}
        >
          {syncing ? "Syncing..." : "Sync inbox"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
            <span className="text-sm font-medium">{r.name}</span>
            {r.account ? (
              <Badge variant="secondary">{r.account}</Badge>
            ) : status && !r.configured ? (
              <Badge variant="outline">Needs setup</Badge>
            ) : null}
            <div className="ml-auto">
              {r.account ? (
                <Button size="sm" variant="ghost" onClick={() => void disconnect({ key, provider: r.id })}>
                  Disconnect
                </Button>
              ) : status && !r.configured ? (
                <Button size="sm" variant="outline" asChild>
                  <a href="#setup">Set up</a>
                </Button>
              ) : (
                <Button size="sm" onClick={() => void connect(r.id)}>
                  Connect
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
