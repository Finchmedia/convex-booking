import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Public sandbox: wipe every booking + setup row, reseed the demo org and
// purge stale guest-admin users. Nothing public can trigger this.
crons.interval("reset sandbox", { hours: 1 }, internal.seed.resetSandbox, {});

export default crons;
