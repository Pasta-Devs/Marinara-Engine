import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
  RouteOptions,
} from "fastify";
import { randomUUID } from "node:crypto";
import type { InjectOptions } from "fastify";
import type { InstalledCapabilityPackage } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../../middleware/privileged-gate.js";

type Cleanup = () => void;
type RouteMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
type RouteDefinition = {
  method: RouteMethod;
  path: string;
  options: Record<string, unknown>;
  handler: RouteHandlerMethod;
};
type RouteSlot = {
  packageId: string;
  active: boolean;
  handler: RouteHandlerMethod;
  internalRouteState: InternalRouteState;
  registrations: number;
};
type PreparedRoute = RouteDefinition & { key: string; path: string; existing?: RouteSlot };
type InternalRouteState = { packageId: string; active: boolean; registrations: number; token: string };

const slotsByApp = new WeakMap<FastifyInstance, Map<string, RouteSlot>>();
const internalRoutesByApp = new WeakMap<FastifyInstance, Map<string, InternalRouteState>>();
const INTERNAL_ROUTE_HEADER = "x-marinara-internal-route";

function routeKey(method: RouteMethod, path: string) {
  return `${method} ${path}`;
}

function normalizeRoute(method: RouteMethod, path: string, optionsOrHandler: unknown, maybeHandler?: unknown) {
  const handler = (typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler) as RouteHandlerMethod;
  if (typeof handler !== "function") throw new Error(`Capability route ${method} ${path} has no handler`);
  return {
    method,
    path,
    options:
      typeof optionsOrHandler === "object" && optionsOrHandler ? (optionsOrHandler as Record<string, unknown>) : {},
    handler,
  } satisfies RouteDefinition;
}

function createRouteCollector(definitions: RouteDefinition[]) {
  const register = (method: RouteMethod) => (path: string, optionsOrHandler: unknown, handler?: unknown) => {
    definitions.push(normalizeRoute(method, path, optionsOrHandler, handler));
  };
  return {
    delete: register("DELETE"),
    get: register("GET"),
    patch: register("PATCH"),
    post: register("POST"),
    put: register("PUT"),
  };
}

export async function registerCapabilityPrivilegedRoutes(
  app: FastifyInstance,
  installed: InstalledCapabilityPackage,
  routes: FastifyPluginAsync,
  options: { prefix: string },
): Promise<Cleanup> {
  if (!installed.manifest.permissions.includes("routes")) {
    throw new Error(`Capability package ${installed.id} must declare the routes permission`);
  }
  const packagePrefix = `/api/${installed.id}`;
  if (options.prefix !== packagePrefix && !options.prefix.startsWith(`${packagePrefix}/`)) {
    throw new Error(`Capability package ${installed.id} route prefix must be under ${packagePrefix}`);
  }

  const definitions: RouteDefinition[] = [];
  await routes(createRouteCollector(definitions) as unknown as FastifyInstance, {});
  const slots = slotsByApp.get(app) ?? new Map<string, RouteSlot>();
  slotsByApp.set(app, slots);
  const internalRoutes = internalRoutesByApp.get(app) ?? new Map<string, InternalRouteState>();
  internalRoutesByApp.set(app, internalRoutes);
  const prepared: PreparedRoute[] = definitions.map((definition) => {
    const suffix =
      definition.path === "/" ? "" : definition.path.startsWith("/") ? definition.path : `/${definition.path}`;
    const path = `${options.prefix}${suffix}`;
    const key = routeKey(definition.method, path);
    const existing = slots.get(key);
    if (existing && existing.packageId !== installed.id) {
      throw new Error(`Capability route ${key} is already registered by ${existing.packageId}`);
    }
    if (!existing && app.hasRoute({ method: definition.method, url: path })) {
      throw new Error(`Capability route ${key} conflicts with an Engine route`);
    }
    return { ...definition, key, path, existing };
  });
  const duplicate = prepared.find(
    (definition, index) => prepared.findIndex((candidate) => candidate.key === definition.key) !== index,
  );
  if (duplicate) {
    throw new Error(`Capability package ${installed.id} registered duplicate route ${duplicate.key}`);
  }
  if (app.server.listening && prepared.some((definition) => !definition.existing)) {
    throw new Error(
      `Capability package ${installed.id} must be restarted before new privileged routes can be activated`,
    );
  }

  const ownedSlots: RouteSlot[] = [];
  const internalRouteState = internalRoutes.get(options.prefix) ?? {
    packageId: installed.id,
    active: false,
    registrations: 0,
    token: randomUUID(),
  };
  const previousSlots = new Map<
    RouteSlot,
    Pick<RouteSlot, "active" | "handler" | "internalRouteState" | "registrations">
  >();
  try {
    internalRouteState.registrations += 1;
    internalRouteState.active = true;
    internalRoutes.set(options.prefix, internalRouteState);
    for (const definition of prepared) {
      if (definition.existing) {
        previousSlots.set(definition.existing, {
          active: definition.existing.active,
          handler: definition.existing.handler,
          internalRouteState: definition.existing.internalRouteState,
          registrations: definition.existing.registrations,
        });
        definition.existing.active = true;
        definition.existing.handler = definition.handler;
        definition.existing.internalRouteState = internalRouteState;
        definition.existing.registrations += 1;
        ownedSlots.push(definition.existing);
        continue;
      }
      const slot: RouteSlot = {
        packageId: installed.id,
        active: true,
        handler: definition.handler,
        internalRouteState,
        registrations: 1,
      };
      slots.set(definition.key, slot);
      ownedSlots.push(slot);
      const onRequest = async (request: FastifyRequest, reply: FastifyReply) => {
        if (!slot.active) return reply.status(404).send({ error: "Capability routes are not active" });
        if (slot.internalRouteState.active && request.headers[INTERNAL_ROUTE_HEADER] === slot.internalRouteState.token)
          return;
        if (!requirePrivilegedAccess(request, reply, { feature: `${installed.manifest.name} package routes` }))
          return reply;
      };
      app.route({
        ...definition.options,
        method: definition.method,
        url: definition.path,
        onRequest,
        handler: (request, reply) => slot.handler.call(app, request, reply),
      } as RouteOptions);
    }
  } catch (error) {
    internalRouteState.registrations = Math.max(0, internalRouteState.registrations - 1);
    internalRouteState.active = internalRouteState.registrations > 0;
    for (const slot of ownedSlots) {
      const previous = previousSlots.get(slot);
      if (previous) Object.assign(slot, previous);
      else {
        slot.registrations = Math.max(0, slot.registrations - 1);
        if (slot.registrations === 0) slot.active = false;
      }
    }
    throw error;
  }

  return () => {
    for (const slot of ownedSlots) {
      slot.registrations = Math.max(0, slot.registrations - 1);
      if (slot.registrations === 0) slot.active = false;
    }
    if (internalRoutes.get(options.prefix) === internalRouteState) {
      internalRouteState.registrations = Math.max(0, internalRouteState.registrations - 1);
      internalRouteState.active = internalRouteState.registrations > 0;
    }
  };
}

export async function runCapabilityInternalRoute(
  app: FastifyInstance,
  packageId: string,
  options: InjectOptions | string,
) {
  const url = typeof options === "string" ? options : options.url;
  if (typeof url !== "string") {
    throw new Error(`Internal route must remain under /api/${packageId}`);
  }
  const pathname = new URL(url, "http://marinara.internal").pathname;
  if (pathname !== `/api/${packageId}` && !pathname.startsWith(`/api/${packageId}/`)) {
    throw new Error(`Internal route must remain under /api/${packageId}`);
  }
  const internalRoutes = internalRoutesByApp.get(app);
  const state = [...(internalRoutes?.entries() ?? [])]
    .filter(
      ([prefix, candidate]) =>
        candidate.active &&
        candidate.packageId === packageId &&
        (pathname === prefix || pathname.startsWith(`${prefix}/`)),
    )
    .sort(([left], [right]) => right.length - left.length)[0]?.[1];
  if (!state?.active || state.packageId !== packageId) {
    throw new Error(`Capability package ${packageId} has no active internal route registration`);
  }
  const request = typeof options === "string" ? { url: options } : options;
  return app.inject({
    ...request,
    headers: { ...request.headers, [INTERNAL_ROUTE_HEADER]: state.token },
  });
}
