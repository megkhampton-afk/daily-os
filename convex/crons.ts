import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Daily Canvas sync. This Convex version's crons.cron has no timezone
// support, so 13:00 UTC = 8:00 AM America/New_York in winter (9:00 AM
// during daylight saving).
const crons = cronJobs();
crons.cron("daily canvas sync", "0 13 * * *", internal.assignments.syncCanvasScheduled, {});
export default crons;
