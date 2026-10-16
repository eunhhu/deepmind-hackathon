import { AgentUnitRegistry } from "../registry";
import {
  parseWorkspaceSynthesizerOutput,
  type WorkspaceSynthesizerOutput,
  type WorkspaceSynthesizerPayload,
  workspaceSynthesizerUnit,
} from "./workspaceSynthesizer";

export {
  parseWorkspaceSynthesizerOutput,
  type WorkspaceSynthesizerOutput,
  type WorkspaceSynthesizerPayload,
  workspaceSynthesizerUnit,
};

/**
 * Default pre-populated registry containing all built-in Gemini 4 Argon agent units.
 * Parallel subagents can register additional domain units here or on custom registries.
 */
export const defaultRegistry = new AgentUnitRegistry().register(workspaceSynthesizerUnit);
