import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// RESOURCE ↔ EVENT TYPE MAPPING
// Many-to-Many relationship with bidirectional indexes
// ============================================

// ============================================
// QUERIES
// ============================================

/**
 * Get all event types linked to a resource
 * Usage: User selects Studio A → show available event types
 */
export const getEventTypesForResource = query({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    // Get all mappings for this resource
    const mappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    // Fetch event types
    const eventTypes = await Promise.all(
      mappings.map(async (mapping) => {
        return await ctx.db
          .query("event_types")
          .withIndex("by_external_id", (q) => q.eq("id", mapping.eventTypeId))
          .unique();
      })
    );

    // Filter out nulls (deleted event types) and inactive event types
    return eventTypes.filter((et) => et !== null && et.isActive !== false);
  },
});

/**
 * Get all resources linked to an event type
 * Usage: Admin views event type → show linked resources
 */
export const getResourcesForEventType = query({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    // Get all mappings for this event type
    const mappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_event_type", (q) => q.eq("eventTypeId", args.eventTypeId))
      .collect();

    // Fetch resources
    const resources = await Promise.all(
      mappings.map(async (mapping) => {
        return await ctx.db
          .query("resources")
          .withIndex("by_external_id", (q) => q.eq("id", mapping.resourceId))
          .unique();
      })
    );

    // Filter out nulls (deleted resources)
    return resources.filter((r) => r !== null);
  },
});

/**
 * Check if a specific link exists
 */
export const hasLink = query({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .filter((q) => q.eq(q.field("eventTypeId"), args.eventTypeId))
      .unique();

    return mapping !== null;
  },
});

/**
 * Get all resource IDs linked to an event type (lightweight)
 * Returns just IDs for cases where you don't need full resource data
 */
export const getResourceIdsForEventType = query({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_event_type", (q) => q.eq("eventTypeId", args.eventTypeId))
      .collect();

    return mappings.map((m) => m.resourceId);
  },
});

/**
 * Get all event type IDs linked to a resource (lightweight)
 */
export const getEventTypeIdsForResource = query({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    return mappings.map((m) => m.eventTypeId);
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Link a resource to an event type
 */
export const linkResourceToEventType = mutation({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if resource exists
    const resource = await ctx.db
      .query("resources")
      .withIndex("by_external_id", (q) => q.eq("id", args.resourceId))
      .unique();

    if (!resource) {
      throw new Error(`Resource "${args.resourceId}" not found`);
    }

    // Check if event type exists
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.eventTypeId))
      .unique();

    if (!eventType) {
      throw new Error(`Event type "${args.eventTypeId}" not found`);
    }

    // Check if link already exists
    const existing = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .filter((q) => q.eq(q.field("eventTypeId"), args.eventTypeId))
      .unique();

    if (existing) {
      // Link already exists, return existing ID
      return existing._id;
    }

    // Create the link
    return await ctx.db.insert("resource_event_types", {
      resourceId: args.resourceId,
      eventTypeId: args.eventTypeId,
    });
  },
});

/**
 * Unlink a resource from an event type
 */
export const unlinkResourceFromEventType = mutation({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .filter((q) => q.eq(q.field("eventTypeId"), args.eventTypeId))
      .unique();

    if (!mapping) {
      // No link exists, nothing to do
      return { success: true, existed: false };
    }

    await ctx.db.delete(mapping._id);
    return { success: true, existed: true };
  },
});

/**
 * Set all resources for an event type (replace existing links)
 * Usage: Admin updates event type form with resource checkboxes
 */
export const setResourcesForEventType = mutation({
  args: {
    eventTypeId: v.string(),
    resourceIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if event type exists
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.eventTypeId))
      .unique();

    if (!eventType) {
      throw new Error(`Event type "${args.eventTypeId}" not found`);
    }

    // Get current links
    const existingMappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_event_type", (q) => q.eq("eventTypeId", args.eventTypeId))
      .collect();

    const existingResourceIds = new Set(existingMappings.map((m) => m.resourceId));
    const newResourceIds = new Set(args.resourceIds);

    // Delete removed links
    for (const mapping of existingMappings) {
      if (!newResourceIds.has(mapping.resourceId)) {
        await ctx.db.delete(mapping._id);
      }
    }

    // Add new links
    for (const resourceId of args.resourceIds) {
      if (!existingResourceIds.has(resourceId)) {
        // Verify resource exists
        const resource = await ctx.db
          .query("resources")
          .withIndex("by_external_id", (q) => q.eq("id", resourceId))
          .unique();

        if (resource) {
          await ctx.db.insert("resource_event_types", {
            resourceId,
            eventTypeId: args.eventTypeId,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Set all event types for a resource (replace existing links)
 * Usage: Admin updates resource form with event type checkboxes
 */
export const setEventTypesForResource = mutation({
  args: {
    resourceId: v.string(),
    eventTypeIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if resource exists
    const resource = await ctx.db
      .query("resources")
      .withIndex("by_external_id", (q) => q.eq("id", args.resourceId))
      .unique();

    if (!resource) {
      throw new Error(`Resource "${args.resourceId}" not found`);
    }

    // Get current links
    const existingMappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    const existingEventTypeIds = new Set(existingMappings.map((m) => m.eventTypeId));
    const newEventTypeIds = new Set(args.eventTypeIds);

    // Delete removed links
    for (const mapping of existingMappings) {
      if (!newEventTypeIds.has(mapping.eventTypeId)) {
        await ctx.db.delete(mapping._id);
      }
    }

    // Add new links
    for (const eventTypeId of args.eventTypeIds) {
      if (!existingEventTypeIds.has(eventTypeId)) {
        // Verify event type exists
        const eventType = await ctx.db
          .query("event_types")
          .withIndex("by_external_id", (q) => q.eq("id", eventTypeId))
          .unique();

        if (eventType) {
          await ctx.db.insert("resource_event_types", {
            resourceId: args.resourceId,
            eventTypeId,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Delete all links for a resource (used when deleting a resource)
 */
export const deleteAllLinksForResource = mutation({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    for (const mapping of mappings) {
      await ctx.db.delete(mapping._id);
    }

    return { deleted: mappings.length };
  },
});

/**
 * Delete all links for an event type (used when deleting an event type)
 */
export const deleteAllLinksForEventType = mutation({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query("resource_event_types")
      .withIndex("by_event_type", (q) => q.eq("eventTypeId", args.eventTypeId))
      .collect();

    for (const mapping of mappings) {
      await ctx.db.delete(mapping._id);
    }

    return { deleted: mappings.length };
  },
});
