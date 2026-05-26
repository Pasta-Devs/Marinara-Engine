import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

const PROMPT_KEY = "magic-rewrite-prompt";

type RewriteResponse = { text: string };

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

export function useMagicRewrite(value: string) {
  const [instruction, setInstruction] = useState(readStoredInstruction);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => writeStoredInstruction(instruction), 300);
    return () => window.clearTimeout(timer);
  }, [instruction]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<RewriteResponse>("/magic-rewrite/generate", {
        text: value,
        instruction,
      });
      setResult(response.text ?? "");
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
