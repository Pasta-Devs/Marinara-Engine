// ──────────────────────────────────────────────
// Hooks: Custom Tools (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCustomToolSchema,
  updateCustomToolSchema,
} from "../../../../engine/contracts/schemas/custom-tool.schema";
import { customToolApi } from "../../../../shared/api/custom-tool-api";
import { storageApi } from "../../../../shared/api/storage-api";

export interface CustomToolRow {
  id: string;
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  executionType: string;
  webhookUrl: string | null;
  staticResult: string | null;
  enabled: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CustomToolCapabilities {
  staticResults?: boolean;
  webhooks?: boolean;
  scriptExecutionEnabled?: boolean;
}

function isEnabledFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return false;
}

export function isCustomToolSelectable(tool: CustomToolRow, _capabilities?: CustomToolCapabilities | null): boolean {
  if (!isEnabledFlag(tool.enabled)) return false;
  if (tool.executionType === "static") return !!tool.staticResult?.trim();
  if (tool.executionType === "webhook") return !!tool.webhookUrl?.trim();
  return false;
}

const toolKeys = {
  all: ["custom-tools"] as const,
  capabilities: ["custom-tools", "capabilities"] as const,
};

export function useCustomTools() {
  return useQuery({
    queryKey: toolKeys.all,
    queryFn: () => storageApi.list<CustomToolRow>("custom-tools"),
  });
}

export function useCustomToolCapabilities() {
  return useQuery({
    queryKey: toolKeys.capabilities,
    queryFn: () => customToolApi.capabilities<CustomToolCapabilities>(),
  });
}

export function useCreateCustomTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      storageApi.create("custom-tools", createCustomToolSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: toolKeys.all });
    },
  });
}

export function useUpdateCustomTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      storageApi.update("custom-tools", id, updateCustomToolSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: toolKeys.all });
    },
  });
}

export function useDeleteCustomTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("custom-tools", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: toolKeys.all });
    },
  });
}
