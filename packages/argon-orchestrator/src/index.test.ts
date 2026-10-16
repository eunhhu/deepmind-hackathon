import { describe, expect, it } from "bun:test";
import {
  AgentUnitRegistry,
  ArgonParallelOrchestrator,
  defaultRegistry,
  defineAgentUnit,
  extractFullText,
  extractSteps,
  routeTaskEffort,
  runVerifyCritiquePolishPipeline,
  workspaceSynthesizerUnit,
} from "./index";

describe("extractFullText & extractSteps", () => {
  it("extracts text from a single model_output step", () => {
    const text = extractFullText({
      id: "inter_single",
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: "Single step output" }],
        },
      ],
    });
    expect(text).toBe("Single step output");
  });

  it("joins all model_output steps across multi-hop long decode turns", () => {
    const text = extractFullText({
      id: "inter_multihop",
      output_text: "Part 2",
      steps: [
        {
          type: "thought",
          summary: "Planning part 1",
        },
        {
          type: "model_output",
          content: [{ type: "text", text: "Part 1 - " }],
        },
        {
          type: "thought",
          summary: "Continuing long decode part 2",
        },
        {
          type: "model_output",
          content: [{ type: "text", text: "Part 2" }],
        },
      ],
    });
    expect(text).toBe("Part 1 - Part 2");
  });

  it("falls back to output_text when steps are missing or empty", () => {
    const text = extractFullText({
      id: "inter_fallback",
      output_text: "Fallback text response",
      steps: [],
    });
    expect(text).toBe("Fallback text response");
  });

  it("extracts thought summaries, model_output text, and tool call labels via extractSteps", () => {
    const steps = extractSteps({
      id: "inter_steps",
      steps: [
        {
          type: "thought",
          summary: "Analyzing workspace architecture",
        },
        {
          type: "google_search_call",
          name: "google_search",
        },
        {
          type: "model_output",
          content: [{ type: "text", text: "Final synthesized output" }],
        },
      ],
    });

    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({
      index: 0,
      type: "thought",
      thoughtSummary: "Analyzing workspace architecture",
    });
    expect(steps[1]).toEqual({
      index: 1,
      type: "google_search_call",
      text: "Tool call: google_search",
    });
    expect(steps[2]).toEqual({
      index: 2,
      type: "model_output",
      text: "Final synthesized output",
    });
  });
});

describe("AgentUnitRegistry & workspace-synthesizer unit", () => {
  it("pre-registers workspace-synthesizer in defaultRegistry and supports custom unit registration", () => {
    const builtIn = defaultRegistry.get("workspace-synthesizer");
    expect(builtIn).toBeDefined();
    expect(builtIn?.label).toBe("Workspace AI Synthesizer");

    const registry = new AgentUnitRegistry();
    const customUnit = defineAgentUnit<{ query: string }, { echoed: string }>({
      id: "custom-analyzer",
      label: "Custom Analyzer",
      defaultThinkingLevel: "high",
      buildPrompt: (payload) => `Analyze: ${payload.query}`,
      parseOutput: (raw) => ({ echoed: raw }),
    });

    registry.register(customUnit);
    expect(registry.get("custom-analyzer")).toBeDefined();
    expect(registry.list()).toEqual([
      {
        id: "custom-analyzer",
        label: "Custom Analyzer",
        defaultThinkingLevel: "high",
        useManagedAgent: false,
      },
    ]);
  });

  it("builds prompts and parses both JSON and fallback text in workspace-synthesizer", () => {
    const prompt = workspaceSynthesizerUnit.buildPrompt({
      title: "Implement Argon Context Forking",
      description: "Share root interaction ID across 8 goroutines",
      category: "architecture",
    });

    expect(prompt).toContain("Implement Argon Context Forking");
    expect(prompt).toContain("Category: architecture");

    const parsedJson = workspaceSynthesizerUnit.parseOutput?.(
      '```json\n{"aiSummary": "Forks root interaction for 95% cache savings.", "suggestedTags": ["Argon", "Caching"]}\n```',
    );
    expect(parsedJson).toEqual({
      aiSummary: "Forks root interaction for 95% cache savings.",
      suggestedTags: ["argon", "caching"],
    });

    const parsedFallback = workspaceSynthesizerUnit.parseOutput?.(
      "Plain text fallback summary without JSON wrapper",
    );
    expect(parsedFallback).toEqual({
      aiSummary: "Plain text fallback summary without JSON wrapper",
      suggestedTags: ["workspace", "gemini-4-argon"],
    });
  });

  it("executes runUnit and runUnitsParallel deterministically in dryRun mode", async () => {
    const orchestrator = new ArgonParallelOrchestrator();

    const singleResult = await defaultRegistry.runUnit(
      orchestrator,
      {
        unitId: "workspace-synthesizer",
        payload: {
          title: "Zero-Overhead SolidJS Store",
          description: "Fine-grained signals with Firestore dual store",
          category: "frontend",
        },
      },
      { dryRun: true },
    );

    expect(singleResult.status).toBe("completed");
    expect(singleResult.unitId).toBe("workspace-synthesizer");
    expect(singleResult.interactionId).toBe("dryrun_workspace-synthesizer");
    expect(singleResult.structuredOutput?.aiSummary).toContain("Zero-Overhead SolidJS Store");
    expect(singleResult.structuredOutput?.suggestedTags).toContain("frontend");
    expect(singleResult.steps.length).toBeGreaterThanOrEqual(2);

    const parallelResults = await defaultRegistry.runUnitsParallel(
      orchestrator,
      [
        {
          unitId: "workspace-synthesizer",
          payload: {
            title: "Task Alpha",
            description: "First parallel unit",
            category: "alpha",
          },
        },
        {
          unitId: "workspace-synthesizer",
          payload: {
            title: "Task Beta",
            description: "Second parallel unit",
            category: "beta",
          },
        },
      ],
      { dryRun: true, sharedContext: "Hackathon global specification" },
    );

    expect(parallelResults).toHaveLength(2);
    expect(parallelResults[0]?.status).toBe("completed");
    expect(parallelResults[1]?.status).toBe("completed");
    expect(parallelResults[0]?.structuredOutput).toBeDefined();
    expect(parallelResults[1]?.structuredOutput).toBeDefined();
  });

  it("routes task effort across tiers and runs Verify-Critique-Polish pipeline in dryRun mode", async () => {
    const trivial = routeTaskEffort({ prompt: "Classify tag", complexityHint: "trivial" });
    expect(trivial.tier).toBe("instant-flash-lite");
    expect(trivial.model).toBe("gemini-3.5-flash-lite");

    const sandbox = routeTaskEffort({ prompt: "Run container tests", requiresSandbox: true });
    expect(sandbox.tier).toBe("autonomous-sandbox");
    expect(sandbox.useManagedAgent).toBe(true);

    const longDecode = routeTaskEffort({
      prompt: "Generate full 200K spec",
      requiresLongDecode: true,
    });
    expect(longDecode.tier).toBe("long-decode-argon");
    expect(longDecode.background).toBe(true);

    const orchestrator = new ArgonParallelOrchestrator();
    const polishRes = await runVerifyCritiquePolishPipeline(orchestrator, {
      artifactTitle: "Preline Dashboard Card",
      artifactType: "ui-preline",
      draftContent: "<div class='p-4'>Draft Card</div>",
      dryRun: true,
    });

    expect(polishRes.finalScore).toBeGreaterThan(polishRes.initialScore);
    expect(polishRes.critiqueItems.length).toBeGreaterThanOrEqual(3);
    expect(polishRes.polishedOutput).toContain("Draft Card");
  });

  it("registers and executes AEGIS-4 security units (aegis-cd-classifier, aegis-sandbox-poc, aegis-tri-remediator) in dryRun mode", async () => {
    expect(defaultRegistry.get("aegis-cd-classifier")).toBeDefined();
    expect(defaultRegistry.get("aegis-sandbox-poc")).toBeDefined();
    expect(defaultRegistry.get("aegis-tri-remediator")).toBeDefined();
    expect(defaultRegistry.get("aegis-sandbox-poc")?.useManagedAgent).toBe(true);

    const orchestrator = new ArgonParallelOrchestrator();
    const results = await defaultRegistry.runUnitsParallel(
      orchestrator,
      [
        {
          unitId: "aegis-cd-classifier",
          payload: {
            name: "Checkout Edge Gateway",
            intakeMode: "github",
            repoUrl: "https://github.com/acme/checkout-gateway",
          },
        },
        {
          unitId: "aegis-sandbox-poc",
          payload: {
            targetName: "Checkout Edge Gateway",
            targetType: "api",
            cveOrCwe: "CVE-2026-4108",
            location: "internal/auth/jwt_middleware.go:88",
            pocPayload: 'curl -H "Authorization: Bearer ..."',
            phase: "red",
          },
        },
        {
          unitId: "aegis-tri-remediator",
          payload: {
            targetName: "Checkout Edge Gateway",
            remediationMode: "git-pr",
            vulnerabilityTitle: "SQL Injection in JWT kid Header",
            location: "internal/auth/jwt_middleware.go:88",
            rootCause: "Unparameterized SQL query concatenation on JWT header kid parameter",
          },
        },
      ],
      { dryRun: true },
    );

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === "completed")).toBe(true);
  });
});
