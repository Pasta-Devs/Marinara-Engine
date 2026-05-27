import { useEffect, useState } from "react";
import { llmApi } from "../api/llm-api";
import { storageApi } from "../api/storage-api";

const PROMPT_KEY = "magic-rewrite-prompt";

const REWRITE_SYSTEM_PROMPT = `You are a rewriting assistant for roleplay, fiction, and worldbuilding content.
Rewrite or generate the requested text according to the user's instructions.
Return ONLY the rewritten text -- no explanations, no markdown fences, no preamble.`;

type ConnectionRecord = {
  id?: unknown;
  provider?: unknown;
  isDefault?: unknown;
  default?: unknown;
};

function boolish(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function readStoredInstruction() {
  try {
    return window.localStorage.getItem(PROMPT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredInstruction(instruction: string) {
  try {
    window.localStorage.setItem(PROMPT_KEY, instruction);
  } catch {
    // Ignore storage failures; the rewrite flow still works without persistence.
  }
}

function buildRewriteMessages(value: string, instructionValue: string) {
  const text = value.trim();
  const hasSourceText = text.length > 0;
  const instruction =
    instructionValue.trim() ||
    (hasSourceText
      ? "Improve this text while preserving its meaning."
      : "Generate suitable content.");

  return [
    { role: "system" as const, content: REWRITE_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: hasSourceText
        ? `Instruction:\n${instruction}\n\n---\n\nText to rewrite:\n${value}`
        : `Instruction:\n${instruction}\n\n---\n\nNo source text was provided; generate new content from the instruction.`,
    },
  ];
}

async function resolveDefaultConnectionId() {
  const connections = await storageApi.list<ConnectionRecord>("connections");
  const textConnections = connections.filter(
    (connection) => connection.provider !== "image_generation",
  );
  const selected =
    textConnections.find(
      (connection) =>
        boolish(connection.isDefault) || boolish(connection.default),
    ) ?? textConnections[0];
  const connectionId =
    typeof selected?.id === "string" ? selected.id.trim() : "";

  if (!connectionId) throw new Error("No text connection configured");

  return connectionId;
}

export function useMagicRewrite(value: string) {
  const [instruction, setInstruction] = useState(readStoredInstruction);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => writeStoredInstruction(instruction),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [instruction]);

  async function generate() {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const connectionId = await resolveDefaultConnectionId();
      const text = await llmApi.complete({
        connectionId,
        messages: buildRewriteMessages(value, instruction),
        parameters: { temperature: 0.7, maxTokens: 4000 },
      });
      setResult(text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Magic Rewrite failed");
    } finally {
      setLoading(false);
    }
  }

  return {
    instruction,
    setInstruction,
    result,
    loading,
    error,
    generate,
  };
}
