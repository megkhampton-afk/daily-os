import { errorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ReloadIcon } from "@radix-ui/react-icons";
import { getKey } from "@/lib/key";

type Provider = "google" | "microsoft";
type Folder = { externalId: string; name: string };

function ProviderFolders({ provider, account }: { provider: Provider; account: string }) {
  const key = getKey();
  const listRemote = useAction(api.folders.listRemote);
  const createRemote = useAction(api.folders.createRemote);
  const setSelected = useMutation(api.folders.setSelected);
  const selected = useQuery(api.folders.selected, { key });

  const [remote, setRemote] = useState<Folder[] | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const chosen = (selected ?? []).filter((f) => f.provider === provider);
  const chosenIds = new Set(chosen.map((f) => f.externalId));

  async function load() {
    setLoading(true);
    try {
      const r = await listRemote({ key, provider });
      setRemote(r.folders);
      setError(r.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once per connected account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, account]);

  async function toggle(folder: Folder, on: boolean) {
    const next = on
      ? [...chosen.map(({ externalId, name }) => ({ externalId, name })), folder]
      : chosen.filter((f) => f.externalId !== folder.externalId).map(({ externalId, name }) => ({ externalId, name }));
    await setSelected({ key, provider, folders: next });
  }

  async function create() {
    setCreating(true);
    try {
      const f = await createRemote({ key, provider, name: newName });
      setRemote((r) => [...(r ?? []), f].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      toast.success(`Created "${f.name}"`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  const label = provider === "google" ? "Gmail labels" : "Outlook folders";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{account}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading} aria-label="Refresh">
          <ReloadIcon className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {remote && remote.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No folders yet. Create one below.</p>
      )}
      <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
        {remote?.map((f) => (
          <label key={f.externalId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox checked={chosenIds.has(f.externalId)} onCheckedChange={(c) => void toggle(f, c === true)} />
            <span className="truncate">{f.name}</span>
          </label>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) void create();
        }}
      >
        <Input placeholder="New folder name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!newName.trim() || creating}>
          {creating ? "Creating..." : "Create"}
        </Button>
      </form>
      {chosen.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sorting order: {chosen.map((f, i) => `${i + 1} ${f.name}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function FolderPicker() {
  const key = getKey();
  const status = useQuery(api.oauth.status, { key });
  const accounts = [
    status?.google ? { provider: "google" as const, account: status.google } : null,
    status?.microsoft ? { provider: "microsoft" as const, account: status.microsoft } : null,
  ].filter((a): a is { provider: Provider; account: string } => a !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sorting folders</CardTitle>
        <CardDescription>
          Pick which of your real folders show up in Email triage. Checked folders get keyboard shortcuts in the order you check them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Connect Gmail or Outlook on the <a className="underline" href="#email">Email triage</a> tab first.
          </p>
        )}
        {accounts.map((a) => (
          <ProviderFolders key={a.provider} provider={a.provider} account={a.account} />
        ))}
      </CardContent>
    </Card>
  );
}
