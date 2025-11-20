import { defineApp } from "convex/server";
import booking from "../packages/convex-booking/src/component/convex.config";

const app = defineApp();
app.use(booking);

export default app;
