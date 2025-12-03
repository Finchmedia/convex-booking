import { defineApp } from "convex/server";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import booking from "@mrfinch/booking/convex.config";

const app = defineApp();
app.use(workOSAuthKit);
app.use(booking);

export default app;
