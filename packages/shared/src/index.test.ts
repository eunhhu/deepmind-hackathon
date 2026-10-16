import { describe, expect, it } from "bun:test";
import {
  DEFAULT_FIREBASE_CONFIG,
  type EntityRecord,
  type FeatureModuleMeta,
  type WorkspaceItemData,
} from "./index";

describe("@deepmind/shared contracts", () => {
  it("exports pre-configured Firebase project and Identity Platform config", () => {
    expect(DEFAULT_FIREBASE_CONFIG.projectId).toBe("h2gdm-hack26icn-2693");
    expect(DEFAULT_FIREBASE_CONFIG.apiKey).toStartWith("AIza");
    expect(DEFAULT_FIREBASE_CONFIG.authDomain).toBe("h2gdm-hack26icn-2693.firebaseapp.com");
  });

  it("validates EntityRecord and FeatureModuleMeta structures", () => {
    const record: EntityRecord<WorkspaceItemData> = {
      id: "item-1",
      collection: "workspace_items",
      ownerUid: "user-123",
      data: {
        title: "Launch Argon Swarm",
        description: "Parallelize across subagents",
        status: "in_progress",
        category: "architecture",
        tags: ["argon", "gin", "solidjs"],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(record.data.status).toBe("in_progress");

    const meta: FeatureModuleMeta = {
      id: "workspace",
      title: "Workspace Hub",
      subtitle: "Firestore CRUD + Argon Synthesis",
      badge: "Starter Unit",
      apiPrefix: "/api/modules/workspace",
      collections: ["workspace_items"],
      agentUnitIds: ["workspace-synthesizer"],
    };
    expect(meta.apiPrefix).toBe("/api/modules/workspace");
  });
});
