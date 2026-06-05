import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChoiceSelectionModal } from "./ChoiceSelectionModal";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPresetDetail = vi.hoisted(() => ({ current: null as unknown }));
const mockUpdateMetadataMutate = vi.hoisted(() => vi.fn());
const mockUpdatePresetMutate = vi.hoisted(() => vi.fn());

vi.mock("../../../../shared/components/ui/Modal", () => ({
  Modal: ({
    children,
    open,
    title,
  }: {
    children: ReactNode;
    open: boolean;
    title: string;
  }) => (open ? <section aria-label={title}>{children}</section> : null),
}));

vi.mock("../hooks/use-presets", () => ({
  usePresetFull: () => ({ data: mockPresetDetail.current, isError: false, isLoading: false }),
  useUpdatePreset: () => ({ mutate: mockUpdatePresetMutate }),
}));

vi.mock("../../chats/index", () => ({
  useUpdateChatMetadata: () => ({ isPending: false, mutate: mockUpdateMetadataMutate }),
}));

const longOptionValue =
  "Offer warm therapeutic roleplay support with gentle check-ins, grounded reflection, collaborative next steps, " +
  "and a calm closing note that the user can read before choosing. UNIQUE_FULL_TEXT_TAIL";

function renderModal({
  multiSelect = false,
  options = [
    { id: "support", label: "Support mode", value: longOptionValue },
    { id: "short", label: "Short mode", value: "Keep the reply short." },
  ],
}: {
  multiSelect?: boolean;
  options?: Array<{ id: string; label: string; value: string }>;
} = {}) {
  mockPresetDetail.current = {
    choiceBlocks: [
      {
        id: "support-mode",
        variableName: "SUPPORT_MODE",
        question: "Choose support mode",
        options,
        multiSelect,
        randomPick: false,
      },
    ],
    preset: { defaultChoices: {} },
  };

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ChoiceSelectionModal open chatId="chat-1" existingChoices={{}} onClose={vi.fn()} presetId="preset-1" />,
    );
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function findButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`Button containing "${text}" was not found`);
  return button;
}

describe("ChoiceSelectionModal", () => {
  beforeEach(() => {
    mockPresetDetail.current = null;
    mockUpdateMetadataMutate.mockReset();
    mockUpdatePresetMutate.mockReset();
    document.body.replaceChildren();
  });

  it.each([
    ["single-select", false, undefined],
    ["multi-select", true, undefined],
    ["boolean toggle", false, [{ id: "support", label: "Support mode", value: longOptionValue }]],
  ])("renders the complete long option value for %s choices", (_name, multiSelect, options) => {
    const { container, root } = renderModal({ multiSelect, options });

    expect(container.textContent).toContain(longOptionValue);
    expect(container.textContent).toContain("UNIQUE_FULL_TEXT_TAIL");

    cleanup(root, container);
  });

  it("keeps single-select option confirmation behavior intact", () => {
    const { container, root } = renderModal();

    act(() => {
      findButton(container, "Short mode").click();
    });
    act(() => {
      findButton(container, "Confirm Choices").click();
    });

    expect(mockUpdateMetadataMutate).toHaveBeenCalledWith(
      { id: "chat-1", presetChoices: { SUPPORT_MODE: "Keep the reply short." } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    cleanup(root, container);
  });
});
