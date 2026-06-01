// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personaApi } from "../../../../shared/api/persona-api";
import { remoteRuntimeTarget } from "../../../../shared/api/remote-runtime";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import { personaKeys } from "../query-keys";
import {
  invalidatePersonaCollectionQueries,
  useDeletePersona,
  usePersona,
  usePersonaSummaries,
  usePersonas,
  useUpdatePersona,
  useUploadPersonaAvatar,
} from "./use-personas";

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

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("../../../../shared/api/remote-runtime", () => ({
  invokeRemote: vi.fn(),
  isRemoteCommand: vi.fn(),
  remoteRuntimeTarget: vi.fn(),
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

const convertFileSrcMock = vi.mocked(convertFileSrc);
const remoteRuntimeTargetMock = vi.mocked(remoteRuntimeTarget);
const storageGetMock = vi.mocked(storageApi.get);
const storageListMock = vi.mocked(storageApi.list);
const storageDeleteMock = vi.mocked(storageApi.delete);
const storageUpdateMock = vi.mocked(storageApi.update);
const uploadAvatarMock = vi.mocked(personaApi.uploadAvatar);
const duplicateMock = vi.mocked(storageCommandsApi.duplicate);

describe("persona hooks", () => {
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
    storageListMock.mockResolvedValue([]);
    storageGetMock.mockResolvedValue(null);
    remoteRuntimeTargetMock.mockReturnValue(null);
    convertFileSrcMock.mockImplementation((path) => `asset://localhost/${encodeURIComponent(path)}`);
    (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__ = {
      convertFileSrc: vi.fn(),
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    storageGetMock.mockReset();
    storageListMock.mockReset();
    storageDeleteMock.mockReset();
    storageUpdateMock.mockReset();
    uploadAvatarMock.mockReset();
    duplicateMock.mockReset();
    convertFileSrcMock.mockReset();
    remoteRuntimeTargetMock.mockReset();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  async function renderHook<THook>(useHook: () => THook): Promise<() => THook> {
    let hook: THook | undefined;

    function Probe() {
      hook = useHook();
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

    if (!hook) {
      throw new Error("Hook did not render");
    }

    return () => {
      if (!hook) {
        throw new Error("Hook did not render");
      }
      return hook;
    };
  }

  async function renderMutation<TMutation>(useHook: () => TMutation): Promise<TMutation> {
    return (await renderHook(useHook))();
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

  it("invalidates persona list and summary caches together", () => {
    queryClient.setQueryData(personaKeys.list, [{ id: "persona-1", name: "Full Persona" }]);
    queryClient.setQueryData(personaKeys.summaries, [{ id: "persona-1", name: "Summary Persona" }]);
    queryClient.setQueryData(personaKeys.detail("persona-1"), { id: "persona-1", name: "Detail Persona" });
    queryClient.setQueryData(personaKeys.active, { id: "persona-1", name: "Active Persona" });

    invalidatePersonaCollectionQueries(queryClient);

    expect(queryClient.getQueryState(personaKeys.list)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(personaKeys.summaries)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(personaKeys.detail("persona-1"))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(personaKeys.active)?.isInvalidated).toBe(false);
  });

  it("projects persona summaries with file-backed avatar fields", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "persona-1",
        name: "Current Persona",
        avatarPath: "data:image/png;base64,large-avatar",
        avatarFilePath: "C:\\Marinara\\avatars\\personas\\Current.png",
        avatarFilename: "Current.png",
        isActive: true,
      },
    ]);

    const getSummaries = await renderHook(usePersonaSummaries);

    await vi.waitFor(() =>
      expect(getSummaries().data).toEqual([
        {
          id: "persona-1",
          name: "Current Persona",
          avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Cpersonas%5CCurrent.png",
          avatarFilePath: "C:\\Marinara\\avatars\\personas\\Current.png",
          avatarFilename: "Current.png",
          isActive: true,
        },
      ]),
    );

    expect(storageListMock).toHaveBeenCalledWith("personas", {
      fields: [
        "id",
        "name",
        "comment",
        "description",
        "tags",
        "avatarPath",
        "avatarFilePath",
        "avatarFilename",
        "avatarCrop",
        "isActive",
        "active",
        "createdAt",
        "nameColor",
        "dialogueColor",
        "boxColor",
      ],
    });
    expect(convertFileSrcMock).toHaveBeenCalledWith("C:\\Marinara\\avatars\\personas\\Current.png");
  });

  it("normalizes managed avatar paths from full persona reads", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "persona-1",
        name: "Current Persona",
        avatarPath: "data:image/png;base64,large-avatar",
        avatarFilePath: "C:\\Marinara\\avatars\\personas\\Current.png",
        avatarFilename: "Current.png",
        personality: "Helpful",
      },
    ]);

    const getPersonas = await renderHook(usePersonas);

    await vi.waitFor(() =>
      expect(getPersonas().data).toEqual([
        {
          id: "persona-1",
          name: "Current Persona",
          avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Cpersonas%5CCurrent.png",
          avatarFilePath: "C:\\Marinara\\avatars\\personas\\Current.png",
          avatarFilename: "Current.png",
          personality: "Helpful",
        },
      ]),
    );

    expect(storageListMock).toHaveBeenCalledWith("personas");
    expect(convertFileSrcMock).toHaveBeenCalledWith("C:\\Marinara\\avatars\\personas\\Current.png");
  });

  it("normalizes missing avatar paths to null from full persona reads", async () => {
    storageListMock.mockResolvedValue([
      {
        id: "persona-1",
        name: "No Avatar Persona",
      },
    ]);

    const getPersonas = await renderHook(usePersonas);

    await vi.waitFor(() =>
      expect(getPersonas().data).toEqual([
        {
          id: "persona-1",
          name: "No Avatar Persona",
          avatarPath: null,
        },
      ]),
    );
  });

  it("normalizes managed avatar paths from persona detail reads", async () => {
    storageGetMock.mockResolvedValue({
      id: "persona-1",
      name: "Current Persona",
      avatarPath: "data:image/png;base64,large-avatar",
      avatarFilePath: "C:\\Marinara\\avatars\\personas\\Current.png",
      avatarFilename: "Current.png",
      description: "Detail row",
    });

    const getPersona = await renderHook(() => usePersona("persona-1"));

    await vi.waitFor(() =>
      expect(getPersona().data).toEqual({
        id: "persona-1",
        name: "Current Persona",
        avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Cpersonas%5CCurrent.png",
        avatarFilePath: "C:\\Marinara\\avatars\\personas\\Current.png",
        avatarFilename: "Current.png",
        description: "Detail row",
      }),
    );

    expect(storageGetMock).toHaveBeenCalledWith("personas", "persona-1");
    expect(convertFileSrcMock).toHaveBeenCalledWith("C:\\Marinara\\avatars\\personas\\Current.png");
  });

  it("invalidates the active persona cache after updating a persona", async () => {
    const updatePersona = await renderMutation(useUpdatePersona);
    primeActivePersonaCache();
    queryClient.setQueryData(personaKeys.summaryDetail("persona-1"), { id: "persona-1", name: "Current Persona" });
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
    expect(queryClient.getQueryState(personaKeys.summaryDetail("persona-1"))?.isInvalidated).toBe(true);
  });

  it("normalizes managed avatar paths in persona update cache writes", async () => {
    const updatePersona = await renderMutation(useUpdatePersona);
    queryClient.setQueryData(personaKeys.list, [
      {
        id: "persona-1",
        name: "Current Persona",
        avatarPath: "data:image/png;base64,old-avatar",
      },
    ]);
    storageUpdateMock.mockResolvedValue({
      id: "persona-1",
      name: "Updated Persona",
      avatarPath: "data:image/png;base64,large-avatar",
      avatarFilePath: "C:\\Marinara\\avatars\\personas\\Updated.png",
      avatarFilename: "Updated.png",
    });

    await act(async () => {
      await updatePersona.mutateAsync({ id: "persona-1", name: "Updated Persona" });
    });

    const expectedPersona = {
      id: "persona-1",
      name: "Updated Persona",
      avatarPath: "asset://localhost/C%3A%5CMarinara%5Cavatars%5Cpersonas%5CUpdated.png",
      avatarFilePath: "C:\\Marinara\\avatars\\personas\\Updated.png",
      avatarFilename: "Updated.png",
    };
    expect(queryClient.getQueryData(personaKeys.detail("persona-1"))).toEqual(expectedPersona);
    expect(queryClient.getQueryData(personaKeys.list)).toEqual([expectedPersona]);
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
