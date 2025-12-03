/**
 * HTTP Router
 *
 * Registers HTTP routes for external services.
 * Currently handles WorkOS AuthKit webhooks for user syncing.
 */
import { httpRouter } from "convex/server";
import { authKit } from "./authClient";

const http = httpRouter();

// Register WorkOS AuthKit webhook routes
// Webhook URL: https://<your-deployment>.convex.site/workos/webhook
authKit.registerRoutes(http);

export default http;
