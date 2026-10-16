import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { getKey } from "@/lib/key";
import { Connections } from "@/Connections";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


function relativeTime(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function EmailTriage() {
  const key = getKey();
  const inboxResult = useQuery(api.emails.inbox, { key });
  const folderCounts = useQuery(api.emails.folderCounts, { key });
  const moveToFolder = useMutation(api.emails.moveToFolder);
  const undoMove = useMutation(api.emails.undoMove);
  const selectedFolders = useQuery(api.folders.selected, { key });
  const [isMoving, setIsMoving] = useState(false);

  const emails = inboxResult ?? [];
  const currentEmail = emails[0];
  const FOLDERS = (selectedFolders ?? [])
    .filter((f) => f.provider === currentEmail?.provider)
    .slice(0, 9);

  const moveCurrentEmail = useCallback(
    async (folder: (typeof FOLDERS)[number]) => {
      if (!currentEmail || isMoving) return;

      const emailId = currentEmail._id;
      setIsMoving(true);
      try {
        await moveToFolder({ key, id: emailId, folderId: folder._id });
        toast.success(`Moved to ${folder.name}`, {
          action: {
            label: "Undo",
            onClick: () => {
              void undoMove({ key, id: emailId }).catch(() => {
                toast.error("Couldn't undo that move.");
              });
            },
          },
        });
      } catch {
        toast.error("Couldn't move this email. Please try again.");
      } finally {
        setIsMoving(false);
      }
    },
    [currentEmail, isMoving, key, moveToFolder, undoMove],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const shortcut = Number(event.key);
      if (shortcut < 1 || shortcut > FOLDERS.length || !currentEmail) return;

      event.preventDefault();
      void moveCurrentEmail(FOLDERS[shortcut - 1]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentEmail, moveCurrentEmail, FOLDERS]);


  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-7 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Email triage
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Make room for what matters.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sort each message into a folder and keep moving.
          </p>
        </div>
        {inboxResult !== undefined && (
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {emails.length} left
          </Badge>
        )}
      </header>

      <Connections />

      {inboxResult === undefined ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-sm text-muted-foreground">
            Loading your inbox…
          </CardContent>
        </Card>
      ) : currentEmail ? (
        <>
          <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="gap-5 p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                    {initials(currentEmail.from)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{currentEmail.from}</p>
                    <CardDescription>
                      Received {relativeTime(currentEmail.receivedAt)}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full">
                  {emails.length} left
                </Badge>
              </div>
              <CardTitle className="text-xl leading-snug sm:text-2xl">
                {currentEmail.subject}
              </CardTitle>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                {currentEmail.snippet}
              </p>
            </CardHeader>
            <CardContent className="border-t bg-muted/20 p-6 sm:p-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Move to</p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Press a number to sort
                </p>
              </div>
              {FOLDERS.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No sorting folders chosen for this account yet.{" "}
                  <a href="#setup" className="font-medium underline">
                    Pick folders on the Setup tab
                  </a>
                  .
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {FOLDERS.map((folder, index) => (
                  <Button
                    key={folder._id}
                    type="button"
                    variant="outline"
                    disabled={isMoving}
                    onClick={() => void moveCurrentEmail(folder)}
                    className="h-auto min-h-12 justify-between gap-2 px-3 py-2"
                    aria-label={`Move to ${folder.name}, shortcut ${index + 1}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <kbd className="hidden size-6 shrink-0 items-center justify-center rounded border bg-background text-xs font-medium text-muted-foreground sm:flex">
                        {index + 1}
                      </kbd>
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <Badge
                      variant="secondary"
                      className="min-w-6 justify-center px-1.5"
                    >
                      {folderCounts?.[folder.name] ?? 0}
                    </Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {emails.length > 1 && (
            <section className="space-y-3" aria-label="Next emails">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Up next</h2>
                <span className="text-xs text-muted-foreground">
                  {Math.min(emails.length - 1, 3)} more
                </span>
              </div>
              <Card className="overflow-hidden rounded-2xl">
                <ul className="divide-y">
                  {emails.slice(1, 4).map((email) => (
                    <li
                      key={email._id}
                      className="flex items-start justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {email.from}
                        </p>
                        <p className="mt-0.5 truncate text-sm">
                          {email.subject}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {email.snippet}
                        </p>
                      </div>
                      <time className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                        {relativeTime(email.receivedAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      ) : (
        <Card className="rounded-2xl border-dashed shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-xl">
              ✓
            </div>
            <h2 className="text-xl font-semibold">Inbox empty</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Connect an account above and press Sync inbox to pull your latest emails.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
