import { defineAgentUnit } from "../registry";

export interface WorkspaceSynthesizerPayload {
  title: string;
  description: string;
  category?: string;
}

export interface WorkspaceSynthesizerOutput {
  aiSummary: string;
  suggestedTags: string[];
}

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseWorkspaceSynthesizerOutput(rawText: string): WorkspaceSynthesizerOutput {
  const candidate = extractJsonBlock(rawText);

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const aiSummary =
      typeof parsed.aiSummary === "string" && parsed.aiSummary.trim().length > 0
        ? parsed.aiSummary.trim()
        : rawText.trim() || "Synthesized workspace item.";

    const rawTags = Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [];
    const suggestedTags = rawTags
      .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim().toLowerCase());

    return {
      aiSummary,
      suggestedTags: suggestedTags.length > 0 ? suggestedTags : ["workspace", "gemini-4-argon"],
    };
  } catch {
    const fallbackSummary = rawText.trim() || "Synthesized workspace item.";
    return {
      aiSummary: fallbackSummary,
      suggestedTags: ["workspace", "gemini-4-argon"],
    };
  }
}

export const workspaceSynthesizerUnit = defineAgentUnit<
  WorkspaceSynthesizerPayload,
  WorkspaceSynthesizerOutput
>({
  id: "workspace-synthesizer",
  label: "Workspace AI Synthesizer",
  defaultThinkingLevel: "low",
  maxOutputTokens: 32768,
  useManagedAgent: false,
  systemInstruction:
    'You are a concise technical synthesizer powered by Gemini 4 Argon. Return only valid JSON with keys "aiSummary" (string) and "suggestedTags" (array of 2-5 lowercase strings).',
  buildPrompt: (payload) => {
    const categoryLine = payload.category ? `\nCategory: ${payload.category}` : "";
    return [
      "Synthesize the following workspace item into an actionable engineering summary and 2-5 lowercase tags.",
      `Title: ${payload.title}${categoryLine}`,
      `Description: ${payload.description}`,
      'Respond strictly with JSON: { "aiSummary": "...", "suggestedTags": ["..."] }',
    ].join("\n");
  },
  parseOutput: parseWorkspaceSynthesizerOutput,
});
