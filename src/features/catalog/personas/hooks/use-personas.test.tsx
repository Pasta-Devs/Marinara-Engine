// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personaApi } from "../../../../shared/api/persona-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import { personaKeys } from "../query-keys";
import { useDeletePersona, useUpdatePersona, useUploadPersonaAvatar } from "./use-personas";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/persona-api", () => ({
  personaApi: {
    activate: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-commands-api", () => ({
  storageCommandsApi: {
    duplicate: vi.fn(),
  },
}));

const storageDeleteMock = vi.mocked(storageApi.delete);
const storageUpdateMock = vi.mocked(storageApi.update);
const uploadAvatarMock = vi.mocked(personaApi.uploadAvatar);
const duplicateMock = vi.mocked(storageCommandsApi.duplicate);

describe("persona mutations", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    storageDeleteMock.mockReset();
    storageUpdateMock.mockReset();
    uploadAvatarMock.mockReset();
    duplicateMock.mockReset();
  });

  async function renderMutation<TMutation>(useHook: () => TMutation): Promise<TMutation> {
    let mutation: TMutation | undefined;

    function Probe() {
      mutation = useHook();
      return null;
    }

    await act(async () => {
      root.render(
        createElement(QueryClientProvider, {
          client: queryClient,
          children: createElement(Probe),
        }),
      );
    });

    if (!mutation) {
      throw new Error("Mutation hook did not render");
    }

    return mutation;
  }

  function primeActivePersonaCache() {
    queryClient.setQueryData(personaKeys.active, {
      id: "persona-1",
      isActive: true,
      name: "Current Persona",
    });

    expect(queryClient.getQueryState(personaKeys.active)?.isInvalidated).toBe(false);
  }

  function expectActivePersonaInvalidated() {
    expect(queryClient.getQueryState(personaKeys.active)?.isInvalidated).toBe(true);
  }

  it("invalidates the active persona cache after updating a persona", async () => {
    const updatePersona = await renderMutation(useUpdatePersona);
    primeActivePersonaCache();
    storageUpdateMock.mockResolvedValue({
      id: "persona-1",
      isActive: true,
      name: "Updated Persona",
    });

    await act(async () => {
      await updatePersona.mutateAsync({ id: "persona-1", name: "Updated Persona" });
    });

    expect(storageUpdateMock).toHaveBeenCalledWith("personas", "persona-1", { name: "Updated Persona" });
    expectActivePersonaInvalidated();
  });

  it("invalidates the active persona cache after deleting a persona", async () => {
    const deletePersona = await renderMutation(useDeletePersona);
    primeActivePersonaCache();
    storageDeleteMock.mockResolvedValue({ deleted: true });

    await act(async () => {
      await deletePersona.mutateAsync("persona-1");
    });

    expect(storageDeleteMock).toHaveBeenCalledWith("personas", "persona-1");
    expectActivePersonaInvalidated();
  });

  it("invalidates the active persona cache after uploading a persona avatar", async () => {
    const uploadPersonaAvatar = await renderMutation(useUploadPersonaAvatar);
    primeActivePersonaCache();
    uploadAvatarMock.mockResolvedValue({ id: "persona-1", avatarPath: "avatars/persona-1.png" });

    await act(async () => {
      await uploadPersonaAvatar.mutateAsync({
        id: "persona-1",
        avatar: "data:image/png;base64,avatar",
        filename: "persona-1.png",
      });
    });

    expect(uploadAvatarMock).toHaveBeenCalledWith("persona-1", "data:image/png;base64,avatar", "persona-1.png");
    expectActivePersonaInvalidated();
  });
});
