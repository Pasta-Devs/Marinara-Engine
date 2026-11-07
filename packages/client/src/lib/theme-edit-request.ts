// A request to open the CSS theme editor on one theme (from the safety bar or a theme preview).
import { create } from "zustand";

export const useThemeEditRequest = create<{ themeId: string | null }>()(() => ({ themeId: null }));

export function requestThemeEdit(themeId: string) {
  useThemeEditRequest.setState({ themeId });
}

export function takeThemeEditRequest(): string | null {
  const { themeId } = useThemeEditRequest.getState();
  if (themeId) useThemeEditRequest.setState({ themeId: null });
  return themeId;
}
