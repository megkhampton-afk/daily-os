import assert from "node:assert/strict";
import { pickCalendar, tokens } from "../convex/calendarMatch.ts";
import { isSetupMode, setSetupMode } from "../src/lib/setupMode.ts";
import { visibleEvents } from "../src/lib/calendarVisibility.ts";

const calendars = [
  { id: "course", name: "2.005" },
  { id: "cms", name: "CMS.300" },
  { id: "club", name: "RoboticsClub" },
];
assert.equal(pickCalendar("2.005 study group tomorrow at 7pm", calendars)?.id, "course");
assert.equal(pickCalendar("two double zero five study group", calendars)?.id, "course");
assert.equal(pickCalendar("cms 300 lecture", calendars)?.id, "cms");
assert.equal(pickCalendar("robotics club meeting", calendars)?.id, "club");
assert.equal(pickCalendar("dinner tomorrow", calendars), null);
const described = [
  { id: "dynamics", name: "2.003 — Dynamics & Control" },
  { id: "games", name: "CMS.300 — Game Studies" },
];
assert.equal(pickCalendar("2.003 study group tomorrow", described)?.id, "dynamics");
assert.equal(pickCalendar("cms 300 study group tomorrow", described)?.id, "games");
assert.equal(pickCalendar("two double zero three study group", described)?.id, "dynamics");
assert.deepEqual(tokens("2 005"), tokens("2.005"));
const events = [
  { id: "main", calendarId: "google:main" },
  { id: "bookings", calendarId: "google:bookings" },
  { id: "legacy" },
];
assert.deepEqual(visibleEvents(events, ["google:bookings"]).map((e) => e.id), ["main", "legacy"]);
assert.deepEqual(visibleEvents(events, []), events);
assert.deepEqual(visibleEvents(events, ["apple:bookings"]), events);
assert.equal(
  pickCalendar("robotics club meeting", [
    { id: "general", name: "Robotics" },
    { id: "specific", name: "Robotics Club" },
  ])?.id,
  "specific",
);

globalThis.window = new EventTarget();
assert.equal(isSetupMode(), false, "Setup starts off");
setSetupMode(true);
assert.equal(isSetupMode(), true, "Setup can be enabled explicitly");
setSetupMode(false);
assert.equal(isSetupMode(), false, "Setup can be disabled");
// A fresh module simulates opening the app again, independent of an earlier toggle.
setSetupMode(true);
const reopened = await import("../src/lib/setupMode.ts?reopened");
assert.equal(reopened.isSetupMode(), false, "Reopening starts with Setup off");
console.log("Calendar matching and setup startup checks passed.");
