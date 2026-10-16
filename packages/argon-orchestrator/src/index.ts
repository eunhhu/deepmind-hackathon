import type {
  ArgonModelId,
  ArgonThinkingLevel,
  InteractionStatus,
  ParallelSwarmRequest,
  ParallelSwarmResponse,
  ParallelTaskInput,
  ParallelTaskResult,
  StepSummary,
} from "@deepmind/shared";
import { GoogleGenAI } from "@google/genai";

export interface InteractionContentPartLike {
  type?: string;
  text?: string;
}

export interface InteractionStepLike {
  type?: string;
  summary?: string;
  name?: string;
  content?: InteractionContentPartLike[];
}

export interface InteractionUsageLike {
  total_tokens?: number;
}

export interface InteractionLike {
  id: string;
  status?: string;
  output_text?: string | null;
  steps?: InteractionStepLike[];
  usage?: InteractionUsageLike;
  error?: unknown;
}

export interface RunTaskOptions {
  model: ArgonModelId;
  systemInstruction?: string;
  previousInteractionId?: string;
  defaultThinkingLevel: ArgonThinkingLevel;
}

/**
 * Joins all `text` content across all `model_output` steps in `interaction.steps`.
 * Required for Gemini 4 Argon long decode (>64K multi-hop outputs), falling back
 * to `interaction.output_text ?? ""`.
 */
export function extractFullText(interaction: InteractionLike): string {
  if (Array.isArray(interaction.steps) && interaction.steps.length > 0) {
    const joined = interaction.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("");

    if (joined.length > 0) {
      return joined;
    }
  }

  return interaction.output_text ?? "";
}

/**
 * Maps `interaction.steps` (`thought`, `model_output`, and tool calls) into structured summaries.
 */
export function extractSteps(interaction: InteractionLike): StepSummary[] {
  if (!Array.isArray(interaction.steps)) {
    return [];
  }

  return interaction.steps.map((step, index) => {
    const summary: StepSummary = {
      index,
      type: step.type ?? "unknown",
    };

    if (step.type === "thought" && typeof step.summary === "string") {
      summary.thoughtSummary = step.summary;
    } else if (step.type === "model_output" && Array.isArray(step.content)) {
      const text = step.content
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text ?? "")
        .join("");
      if (text.length > 0) {
        summary.text = text;
      }
    } else if (typeof step.name === "string" && step.name.length > 0) {
      summary.text = `Tool call: ${step.name}`;
    }

    return summary;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ArgonParallelOrchestrator {
  private readonly client: GoogleGenAI;

  constructor(apiKey?: string) {
    this.client = new GoogleGenAI(apiKey ? { apiKey } : {});
  }

  /**
   * Executes a single task against `gemini-4-argon` or the managed `antigravity-preview-09-2026` agent
   * using the Interactions API (`client.interactions.create`).
   *
   * Strict Gemini 4 Argon compliance:
   * - Never passes `temperature`, `top_p`, `top_k`, or `cached_content`.
   * - Automatically enables `background: true` for long decode (`max_output_tokens > 65536`) or managed agents.
   */
  async runTask(task: ParallelTaskInput, options: RunTaskOptions): Promise<ParallelTaskResult> {
    const startedAt = performance.now();
    const thinkingLevel: ArgonThinkingLevel = task.thinkingLevel ?? options.defaultThinkingLevel;
    const maxOutputTokens = task.maxOutputTokens ?? 65536;
    const isBackground = Boolean(task.background || maxOutputTokens > 65536);

    try {
      let interaction: InteractionLike;

      if (task.useManagedAgent) {
        interaction = (await this.client.interactions.create({
          agent: "antigravity-preview-09-2026",
          input: task.prompt,
          environment: "remote",
          background: task.background ?? true,
          previous_interaction_id: options.previousInteractionId,
          agent_config: {
            type: "antigravity",
            model: "gemini-4-argon",
          },
        })) as InteractionLike;
      } else {
        interaction = (await this.client.interactions.create({
          model: options.model,
          input: task.prompt,
          system_instruction: options.systemInstruction,
          previous_interaction_id: options.previousInteractionId,
          background: isBackground,
          generation_config: {
            thinking_level: thinkingLevel,
            max_output_tokens: maxOutputTokens,
          },
        })) as InteractionLike;
      }

      if (isBackground || interaction.status === "in_progress" || interaction.status === "queued") {
        while (interaction.status === "in_progress" || interaction.status === "queued") {
          await sleep(2000);
          interaction = (await this.client.interactions.get(interaction.id)) as InteractionLike;
        }
      }

      return {
        taskId: task.id,
        label: task.label,
        interactionId: interaction.id,
        status: (interaction.status as InteractionStatus) ?? "completed",
        outputText: extractFullText(interaction),
        steps: extractSteps(interaction),
        durationMs: Math.round(performance.now() - startedAt),
        totalTokens: interaction.usage?.total_tokens,
      };
    } catch (err) {
      return {
        taskId: task.id,
        label: task.label,
        interactionId: "",
        status: "failed",
        outputText: "",
        steps: [],
        durationMs: Math.round(performance.now() - startedAt),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Executes a swarm of tasks in parallel using a zero-overhead bounded worker pool.
   * When `req.sharedContext` is provided, creates a root interaction on `gemini-4-argon`
   * (`thinking_level: "low"`) and forks all parallel tasks via `previous_interaction_id`
   * to trigger the 95% implicit cache discount.
   */
  async runSwarm(
    req: ParallelSwarmRequest,
    onTaskComplete?: (res: ParallelTaskResult) => void,
  ): Promise<ParallelSwarmResponse> {
    const swarmStarted = performance.now();
    const model: ArgonModelId = req.model ?? "gemini-4-argon";
    const defaultThinkingLevel: ArgonThinkingLevel = req.defaultThinkingLevel ?? "medium";
    const maxConcurrency = Math.max(1, req.maxConcurrency ?? 8);

    let rootInteractionId: string | undefined;

    if (req.sharedContext && req.sharedContext.trim().length > 0) {
      const rootInteraction = (await this.client.interactions.create({
        model: "gemini-4-argon",
        input: `Acknowledge and retain this shared context for subsequent parallel tasks:\n\n${req.sharedContext}`,
        system_instruction: req.systemInstruction,
        generation_config: {
          thinking_level: "low",
          max_output_tokens: 32768,
        },
      })) as InteractionLike;

      rootInteractionId = rootInteraction.id;
    }

    const results: ParallelTaskResult[] = new Array(req.tasks.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < req.tasks.length) {
        const currentIndex = cursor;
        cursor += 1;
        const task = req.tasks[currentIndex];
        if (!task) {
          continue;
        }

        const result = await this.runTask(task, {
          model,
          systemInstruction: req.systemInstruction,
          previousInteractionId: rootInteractionId,
          defaultThinkingLevel,
        });

        results[currentIndex] = result;
        onTaskComplete?.(result);
      }
    };

    const workerCount = Math.min(maxConcurrency, req.tasks.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return {
      rootInteractionId,
      totalDurationMs: Math.round(performance.now() - swarmStarted),
      results,
    };
  }
}
