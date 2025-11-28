import { defineApp } from "convex/server";
import booking from "@mrfinch/booking/convex.config";

const app = defineApp();
app.use(booking);

export default app;
