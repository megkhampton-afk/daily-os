import { useEffect, useState } from "react";
import { quoteForDay } from "@/lib/quotes";

export function DailyQuote() {
  const [date, setDate] = useState(() => new Date());
  useEffect(() => {
    const update = () => setDate(new Date());
    const next = new Date(date);
    next.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(update, next.getTime() - date.getTime() + 100);
    window.addEventListener("focus", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
    };
  }, [date]);
  const quote = quoteForDay(date);
  return (
    <div className="mt-2 max-w-2xl space-y-2">
      <p className="text-sm text-muted-foreground">
        {date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <blockquote>
        <p className="text-sm leading-relaxed">“{quote.text}”</p>
        <footer className="mt-1 text-xs text-muted-foreground">
          {quote.author} · <cite>{quote.work}</cite>
        </footer>
      </blockquote>
    </div>
  );
}
