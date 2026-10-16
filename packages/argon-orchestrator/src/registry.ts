import type {
  AgentUnitInput,
  AgentUnitResult,
  ArgonModelId,
  ArgonThinkingLevel,
  ParallelTaskInput,
} from "@deepmind/shared";
import type { ArgonParallelOrchestrator } from "./index";

export interface AgentUnitSpec<
  TPayload = Record<string, unknown>,
  TOutput = Record<string, unknown>,
> {
  id: string;
  label: string;
  defaultThinkingLevel?: ArgonThinkingLevel;
  maxOutputTokens?: number;
  useManagedAgent?: boolean;
  systemInstruction?: string;
  buildPrompt: (payload: TPayload) => string;
  parseOutput?: (rawText: string) => TOutput;
}

export interface AgentUnitSummary {
  id: string;
  label: string;
  defaultThinkingLevel: ArgonThinkingLevel;
  useManagedAgent: boolean;
}

export interface RunUnitOptions {
  dryRun?: boolean;
  model?: ArgonModelId;
}

export interface RunUnitsParallelOptions {
  sharedContext?: string;
  maxConcurrency?: number;
  dryRun?: boolean;
  model?: ArgonModelId;
}

/**
 * Helper to define a strongly-typed modular Gemini 4 Argon agent unit.
 */
export function defineAgentUnit<
  TPayload = Record<string, unknown>,
  TOutput = Record<string, unknown>,
>(spec: AgentUnitSpec<TPayload, TOutput>): AgentUnitSpec<TPayload, TOutput> {
  return spec;
}

function buildDryRunText<TPayload>(
  unit: AgentUnitSpec<TPayload, unknown>,
  payload: TPayload,
  prompt: string,
): string {
  const payloadRecord =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const title =
    typeof payloadRecord.title === "string" && payloadRecord.title.trim().length > 0
      ? payloadRecord.title.trim()
      : unit.label;
  const category =
    typeof payloadRecord.category === "string" && payloadRecord.category.trim().length > 0
      ? payloadRecord.category.trim().toLowerCase()
      : "general";

  return JSON.stringify({
    aiSummary: `[Dry-Run] Synthesized actionable plan for "${title}" using Gemini 4 Argon (${prompt.length} chars prompt).`,
    suggestedTags: [category, unit.id, "gemini-4-argon"],
    unitId: unit.id,
    dryRun: true,
  });
}

export class AgentUnitRegistry {
  private readonly units = new Map<string, AgentUnitSpec<unknown, unknown>>();

  register<TPayload, TOutput>(unit: AgentUnitSpec<TPayload, TOutput>): this {
    this.units.set(unit.id, unit as AgentUnitSpec<unknown, unknown>);
    return this;
  }

  get(unitId: string): AgentUnitSpec<unknown, unknown> | undefined {
    return this.units.get(unitId);
  }

  list(): AgentUnitSummary[] {
    return Array.from(this.units.values()).map((unit) => ({
      id: unit.id,
      label: unit.label,
      defaultThinkingLevel: unit.defaultThinkingLevel ?? "medium",
      useManagedAgent: Boolean(unit.useManagedAgent),
    }));
  }

  async runUnit<TPayload = Record<string, unknown>, TOutput = Record<string, unknown>>(
    orchestrator: ArgonParallelOrchestrator,
    input: AgentUnitInput<TPayload>,
    options?: RunUnitOptions,
  ): Promise<AgentUnitResult<TOutput>> {
    const startedAt = performance.now();
    const registered = this.units.get(input.unitId) as AgentUnitSpec<TPayload, TOutput> | undefined;

    if (!registered) {
      return {
        unitId: input.unitId,
        interactionId: "",
        status: "failed",
        rawText: "",
        steps: [],
        durationMs: Math.round(performance.now() - startedAt),
        error: `Agent unit "${input.unitId}" is not registered`,
      };
    }

    const basePrompt = registered.buildPrompt(input.payload);
    const fullPrompt =
      input.sharedContext && input.sharedContext.trim().length > 0
        ? `Shared Context:\n${input.sharedContext}\n\nTask:\n${basePrompt}`
        : basePrompt;
    const thinkingLevel: ArgonThinkingLevel =
      input.thinkingLevel ?? registered.defaultThinkingLevel ?? "medium";
    const maxOutputTokens = input.maxOutputTokens ?? registered.maxOutputTokens ?? 65536;
    const useManagedAgent = input.useManagedAgent ?? registered.useManagedAgent ?? false;

    const shouldDryRun = Boolean(options?.dryRun || !orchestrator.hasApiKey);

    if (shouldDryRun) {
      const rawText = buildDryRunText(registered, input.payload, fullPrompt);
      const structuredOutput = registered.parseOutput ? registered.parseOutput(rawText) : undefined;

      return {
        unitId: registered.id,
        interactionId: `dryrun_${registered.id}`,
        status: "completed",
        rawText,
        structuredOutput,
        steps: [
          {
            index: 0,
            type: "thought",
            thoughtSummary: `Dry-run reasoning (${thinkingLevel}) for ${registered.label}`,
          },
          {
            index: 1,
            type: "model_output",
            text: rawText,
          },
        ],
        durationMs: Math.round(performance.now() - startedAt),
      };
    }

    const taskResult = await orchestrator.runTask(
      {
        id: registered.id,
        label: registered.label,
        prompt: fullPrompt,
        thinkingLevel,
        maxOutputTokens,
        useManagedAgent,
      },
      {
        model: options?.model ?? "gemini-4-argon",
        systemInstruction: registered.systemInstruction,
        previousInteractionId: input.previousInteractionId,
        defaultThinkingLevel: registered.defaultThinkingLevel ?? "medium",
      },
    );

    let structuredOutput: TOutput | undefined;
    if (taskResult.status === "completed" && registered.parseOutput) {
      try {
        structuredOutput = registered.parseOutput(taskResult.outputText);
      } catch (err) {
        return {
          unitId: registered.id,
          interactionId: taskResult.interactionId,
          status: "failed",
          rawText: taskResult.outputText,
          steps: taskResult.steps,
          durationMs: taskResult.durationMs,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      unitId: registered.id,
      interactionId: taskResult.interactionId,
      status: taskResult.status,
      rawText: taskResult.outputText,
      structuredOutput,
      steps: taskResult.steps,
      durationMs: taskResult.durationMs,
      error: taskResult.error,
    };
  }

  async runUnitsParallel(
    orchestrator: ArgonParallelOrchestrator,
    inputs: AgentUnitInput<Record<string, unknown>>[],
    options?: RunUnitsParallelOptions,
  ): Promise<AgentUnitResult<Record<string, unknown>>[]> {
    if (inputs.length === 0) {
      return [];
    }

    const shouldDryRun = Boolean(options?.dryRun || !orchestrator.hasApiKey);
    if (shouldDryRun) {
      return Promise.all(
        inputs.map((input) =>
          this.runUnit<Record<string, unknown>, Record<string, unknown>>(
            orchestrator,
            {
              ...input,
              sharedContext: input.sharedContext ?? options?.sharedContext,
            },
            {
              dryRun: true,
              model: options?.model,
            },
          ),
        ),
      );
    }

    const tasks: ParallelTaskInput[] = [];
    const indexMap: number[] = [];
    const results: AgentUnitResult<Record<string, unknown>>[] = new Array(inputs.length);

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i];
      if (!input) {
        continue;
      }
      const unit = this.units.get(input.unitId);
      if (!unit) {
        results[i] = {
          unitId: input.unitId,
          interactionId: "",
          status: "failed",
          rawText: "",
          steps: [],
          durationMs: 0,
          error: `Agent unit "${input.unitId}" is not registered`,
        };
        continue;
      }

      tasks.push({
        id: `${unit.id}_${i}`,
        label: unit.label,
        prompt: unit.buildPrompt(input.payload),
        thinkingLevel: input.thinkingLevel ?? unit.defaultThinkingLevel ?? "medium",
        maxOutputTokens: input.maxOutputTokens ?? unit.maxOutputTokens ?? 65536,
        useManagedAgent: input.useManagedAgent ?? unit.useManagedAgent ?? false,
      });
      indexMap.push(i);
    }

    if (tasks.length > 0) {
      const swarmResponse = await orchestrator.runSwarm({
        sharedContext: options?.sharedContext,
        model: options?.model ?? "gemini-4-argon",
        maxConcurrency: options?.maxConcurrency,
        tasks,
      });

      for (let t = 0; t < swarmResponse.results.length; t += 1) {
        const taskRes = swarmResponse.results[t];
        const originalIndex = indexMap[t];
        if (!taskRes || originalIndex === undefined) {
          continue;
        }
        const input = inputs[originalIndex];
        const unit = input ? this.units.get(input.unitId) : undefined;
        if (!input || !unit) {
          continue;
        }

        let structuredOutput: Record<string, unknown> | undefined;
        if (taskRes.status === "completed" && unit.parseOutput) {
          structuredOutput = unit.parseOutput(taskRes.outputText) as Record<string, unknown>;
        }

        results[originalIndex] = {
          unitId: unit.id,
          interactionId: taskRes.interactionId,
          status: taskRes.status,
          rawText: taskRes.outputText,
          structuredOutput,
          steps: taskRes.steps,
          durationMs: taskRes.durationMs,
          error: taskRes.error,
        };
      }
    }

    return results;
  }
}
