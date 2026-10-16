import type { FeatureModuleMeta } from "@deepmind/shared";
import type { Component } from "solid-js";
import { SwarmModule } from "./swarm/SwarmModule";
import { WorkspaceModule } from "./workspace/WorkspaceModule";

export interface FrontendFeatureModule extends FeatureModuleMeta {
  Component: Component;
}

export const FRONTEND_MODULES: FrontendFeatureModule[] = [
  {
    id: "workspace",
    title: "Workspace + Firestore Hub",
    subtitle: "Cloud Firestore Native CRUD + Gemini 4 Argon Executive Synthesizer",
    badge: "FIRESTORE + AI",
    apiPrefix: "/api/modules/workspace",
    collections: ["workspace_items"],
    agentUnitIds: ["workspace-synthesizer"],
    Component: WorkspaceModule,
  },
  {
    id: "swarm",
    title: "Argon Parallel Swarm Console",
    subtitle: "Concurrent Gemini 4 Argon Interactions API Fan-Out & Live SSE Thought Stream",
    badge: "SWARM ENGINE",
    apiPrefix: "/api/swarm",
    collections: [],
    agentUnitIds: ["swarm-architect", "code-synthesizer"],
    Component: SwarmModule,
  },
];

export function registerFrontendModule(mod: FrontendFeatureModule): FrontendFeatureModule {
  const existingIdx = FRONTEND_MODULES.findIndex((m) => m.id === mod.id);
  if (existingIdx >= 0) {
    FRONTEND_MODULES[existingIdx] = mod;
  } else {
    FRONTEND_MODULES.push(mod);
  }
  return mod;
}

export function getFrontendModule(id: string): FrontendFeatureModule | undefined {
  return FRONTEND_MODULES.find((m) => m.id === id);
}
