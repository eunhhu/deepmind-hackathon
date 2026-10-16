import { describe, expect, test } from "bun:test";
import { DEFAULT_FIREBASE_CONFIG } from "@deepmind/shared";
import { buildAuthHeaders } from "../core/api/client";
import { getActiveFirebaseConfig, signInDemo, signOut, useAuth } from "../core/auth/firebaseAuth";
import { FRONTEND_MODULES, getFrontendModule, registerFrontendModule } from "./registry";

describe("Frontend Auth, API Client & Plug-and-Play Module Registry", () => {
  test("DEFAULT_FIREBASE_CONFIG and getActiveFirebaseConfig target h2gdm-hack26icn-2693", () => {
    expect(DEFAULT_FIREBASE_CONFIG.projectId).toBe("h2gdm-hack26icn-2693");
    expect(DEFAULT_FIREBASE_CONFIG.apiKey).toStartWith("AIza");

    const active = getActiveFirebaseConfig();
    expect(active.projectId).toBe("h2gdm-hack26icn-2693");
    expect(active.authDomain).toContain("firebaseapp.com");
  });

  test("signInDemo creates an instant hackathon demo session and attaches X-Demo-User header", () => {
    const session = signInDemo("Parallel Tester");
    expect(session.user.provider).toBe("demo");
    expect(session.user.uid).toBe("demo-parallel-tester");

    const headers = buildAuthHeaders();
    expect(headers["X-Demo-User"]).toBe("demo-parallel-tester");

    const auth = useAuth();
    expect(auth.user()?.displayName).toBe("Parallel Tester");

    signOut();
    expect(auth.user()).toBeNull();

    // Restore default demo user after test
    signInDemo("Argon Hackathon Builder");
  });

  test("FRONTEND_MODULES registers aegis, workspace, and swarm modules with valid metadata", () => {
    expect(FRONTEND_MODULES.length).toBeGreaterThanOrEqual(3);
    expect(FRONTEND_MODULES[0]?.id).toBe("aegis");

    const aegisMod = getFrontendModule("aegis");
    expect(aegisMod).toBeDefined();
    expect(aegisMod?.apiPrefix).toBe("/api/modules/aegis");
    expect(aegisMod?.collections).toContain("aegis_projects");
    expect(aegisMod?.agentUnitIds).toContain("aegis-tri-remediator");

    const workspaceMod = getFrontendModule("workspace");
    expect(workspaceMod).toBeDefined();
    expect(workspaceMod?.apiPrefix).toBe("/api/modules/workspace");
    expect(workspaceMod?.collections).toContain("workspace_items");
    expect(workspaceMod?.agentUnitIds).toContain("workspace-synthesizer");

    const swarmMod = getFrontendModule("swarm");
    expect(swarmMod).toBeDefined();
    expect(swarmMod?.apiPrefix).toBe("/api/swarm");
  });

  test("registerFrontendModule dynamically adds or updates a feature module", () => {
    const customMod = registerFrontendModule({
      id: "custom-unit",
      title: "Custom Hackathon Unit",
      subtitle: "Plug-and-play test unit",
      badge: "TEST",
      apiPrefix: "/api/modules/custom",
      collections: ["custom_docs"],
      agentUnitIds: ["custom-agent"],
      Component: () => null,
    });

    expect(getFrontendModule("custom-unit")?.title).toBe(customMod.title);
  });
});
