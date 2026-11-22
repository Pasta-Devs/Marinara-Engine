// ──────────────────────────────────────────────
// Every Home widget there is to show: built in, from agents and packages, and personal ones.
// Shared by Home and Settings › General › Home.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BUILT_IN_AGENTS,
  HOME_CUSTOM_WIDGETS_SETTINGS_KEY,
  homeAgentWidgetsSchema,
  type HomeCustomWidget,
  type HomeCustomWidgetCatalog,
} from "@marinara-engine/shared";
import { api, ApiError } from "../../lib/api-client";
import { useAgentConfigs } from "../../hooks/use-agents";
import { selectHomeWidgetPackages, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { resolveCapabilityPackageDisplay } from "../../lib/capability-package-localization";
import { customHomeWidgetId, packageHomeWidgetId, type AgentHomeWidget } from "../../stores/home-widgets.store";

export function useHomeWidgetCatalog() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const installed = useInstalledCapabilityPackages();
  const agents = useAgentConfigs();
  const customWidgetsQuery = useQuery({
    queryKey: ["home-custom-widgets"],
    queryFn: () => api.get<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`),
  });
  const customWidgets = useMemo(() => customWidgetsQuery.data?.widgets ?? [], [customWidgetsQuery.data?.widgets]);
  const customWidgetIds = useMemo(() => customWidgets.map((widget) => customHomeWidgetId(widget.id)), [customWidgets]);
  const customWidgetsById = useMemo(
    () => new Map(customWidgets.map((widget) => [customHomeWidgetId(widget.id), widget])),
    [customWidgets],
  );
  const deleteCustomWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const catalog = await api.get<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`);
        if (!catalog.widgets.some((widget) => widget.id === widgetId)) return catalog;
        try {
          return await api.put<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`, {
            ...catalog,
            widgets: catalog.widgets.filter((widget) => widget.id !== widgetId),
          });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409 || attempt > 0) throw error;
        }
      }
      throw new Error("Home widget catalog changed repeatedly; try again.");
    },
    onSuccess: (catalog) => queryClient.setQueryData(["home-custom-widgets"], catalog),
    onError: () => queryClient.invalidateQueries({ queryKey: ["home-custom-widgets"] }),
  });
  const updateCustomWidgetMutation = useMutation({
    mutationFn: async (updated: HomeCustomWidget) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const catalog = await api.get<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`);
        if (!catalog.widgets.some((widget) => widget.id === updated.id)) throw new Error("Widget no longer exists");
        try {
          return await api.put<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`, {
            ...catalog,
            widgets: catalog.widgets.map((widget) =>
              widget.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : widget,
            ),
          });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409 || attempt > 0) throw error;
        }
      }
      throw new Error("Home widget catalog changed repeatedly; try again.");
    },
    onSuccess: (catalog) => queryClient.setQueryData(["home-custom-widgets"], catalog),
    onError: () => queryClient.invalidateQueries({ queryKey: ["home-custom-widgets"] }),
  });
  const agentWidgetGroups = useMemo(() => {
    const packageGroups = selectHomeWidgetPackages(installed.data).map((pkg) => {
      const display = resolveCapabilityPackageDisplay(pkg.manifest, i18n.resolvedLanguage ?? i18n.language);
      return {
        id: pkg.id,
        name: display.name,
        widgets: (display.homeWidgets ?? []).map((widget): AgentHomeWidget => ({
          id: packageHomeWidgetId(pkg.id, widget.id),
          kind: "package",
          packageId: pkg.id,
          widgetId: widget.id,
          ownerName: display.name,
          label: widget.label,
          description: widget.description,
          size: widget.size,
          icon: widget.icon,
          iconPath: widget.iconPath,
          accent: widget.accent,
          surface: widget.surface,
          header: widget.header,
        })),
      };
    });
    const customGroups = (agents.data ?? []).flatMap((agent) => {
      if (BUILT_IN_AGENTS.some((builtIn) => builtIn.id === agent.type)) return [];
      const settings = (() => {
        try {
          return JSON.parse(agent.settings) as Record<string, unknown>;
        } catch {
          return {};
        }
      })();
      const parsed = homeAgentWidgetsSchema.safeParse(settings.homeWidgets ?? []);
      if (!parsed.success || parsed.data.length === 0) return [];
      return [
        {
          id: agent.id,
          name: agent.name,
          widgets: parsed.data.map((widget): AgentHomeWidget => ({
            id: `agent:custom:${agent.id}:${widget.id}`,
            kind: "custom",
            agentId: agent.id,
            widgetId: widget.id,
            ownerName: agent.name,
            label: widget.title,
            description: widget.description,
            size: widget.size,
            icon: widget.icon,
            accent: widget.accent,
            surface: widget.surface,
            header: widget.header,
          })),
        },
      ];
    });
    return [...packageGroups, ...customGroups];
  }, [installed.data, agents.data, i18n.language, i18n.resolvedLanguage]);
  return {
    customWidgetsQuery,
    customWidgets,
    customWidgetIds,
    customWidgetsById,
    deleteCustomWidgetMutation,
    updateCustomWidgetMutation,
    agentWidgetGroups,
  };
}
