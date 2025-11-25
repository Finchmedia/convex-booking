import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// ORGANIZATION QUERIES
// ============================================

export const getOrganization = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

// ============================================
// ORGANIZATION MUTATIONS
// ============================================

export const createOrganization = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    slug: v.string(),
    settings: v.optional(
      v.object({
        defaultTimezone: v.optional(v.string()),
        defaultCurrency: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check for existing slug
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      throw new Error(`Organization with slug "${args.slug}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("organizations", {
      id: args.id,
      name: args.name,
      slug: args.slug,
      settings: args.settings,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateOrganization = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    settings: v.optional(
      v.object({
        defaultTimezone: v.optional(v.string()),
        defaultCurrency: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!org) {
      throw new Error(`Organization "${args.id}" not found`);
    }

    // Check slug uniqueness if changing
    if (args.slug && args.slug !== org.slug) {
      const existingSlug = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique();
      if (existingSlug) {
        throw new Error(`Organization with slug "${args.slug}" already exists`);
      }
    }

    await ctx.db.patch(org._id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.slug !== undefined && { slug: args.slug }),
      ...(args.settings !== undefined && { settings: args.settings }),
      updatedAt: Date.now(),
    });

    return org._id;
  },
});

export const deleteOrganization = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!org) {
      throw new Error(`Organization "${args.id}" not found`);
    }

    // Delete all related data
    // Teams
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();
    for (const team of teams) {
      await ctx.db.delete(team._id);
    }

    // Members
    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    await ctx.db.delete(org._id);
    return { success: true };
  },
});

// ============================================
// TEAM QUERIES
// ============================================

export const getTeam = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const listTeams = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

// ============================================
// TEAM MUTATIONS
// ============================================

export const createTeam = mutation({
  args: {
    id: v.string(),
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("teams", {
      id: args.id,
      organizationId: args.organizationId,
      name: args.name,
      slug: args.slug,
      createdAt: Date.now(),
    });
  },
});

export const updateTeam = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!team) {
      throw new Error(`Team "${args.id}" not found`);
    }

    await ctx.db.patch(team._id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.slug !== undefined && { slug: args.slug }),
    });

    return team._id;
  },
});

export const deleteTeam = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!team) {
      throw new Error(`Team "${args.id}" not found`);
    }

    await ctx.db.delete(team._id);
    return { success: true };
  },
});

// ============================================
// MEMBER QUERIES
// ============================================

export const getMember = query({
  args: {
    userId: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return members.find((m) => m.organizationId === args.organizationId) || null;
  },
});

export const listMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const listUserOrganizations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId);
        return org ? { ...org, role: m.role } : null;
      })
    );

    return orgs.filter(Boolean);
  },
});

// ============================================
// MEMBER MUTATIONS
// ============================================

export const addMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.id("organizations"),
    teamId: v.optional(v.id("teams")),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already a member
    const existing = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const alreadyMember = existing.find(
      (m) => m.organizationId === args.organizationId
    );

    if (alreadyMember) {
      throw new Error("User is already a member of this organization");
    }

    return await ctx.db.insert("members", {
      userId: args.userId,
      organizationId: args.organizationId,
      teamId: args.teamId,
      role: args.role,
      joinedAt: Date.now(),
    });
  },
});

export const updateMember = mutation({
  args: {
    memberId: v.id("members"),
    role: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    await ctx.db.patch(args.memberId, {
      ...(args.role !== undefined && { role: args.role }),
      ...(args.teamId !== undefined && { teamId: args.teamId }),
    });

    return args.memberId;
  },
});

export const removeMember = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    await ctx.db.delete(args.memberId);
    return { success: true };
  },
});
