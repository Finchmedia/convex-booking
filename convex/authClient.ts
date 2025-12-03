/**
 * WorkOS AuthKit Client
 *
 * This is the integration with @convex-dev/workos-authkit component.
 * It provides user syncing via webhooks and typed access to user data.
 */
import { AuthKit } from "@convex-dev/workos-authkit";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit);
