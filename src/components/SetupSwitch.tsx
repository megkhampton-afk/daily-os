import { cn } from "@/lib/utils";

export function SetupSwitch({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Setup mode"
      title={on ? "Hide setup tools" : "Show setup tools"}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 rounded-full px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <span>Setup</span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-background shadow transition-transform",
            on ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
