import { lazy } from "react";

export type { ChatGalleryDrawerProps } from "./components/ChatGalleryDrawer";

export const ChatGalleryDrawer = lazy(async () => {
  const module = await import("./components/ChatGalleryDrawer");
  return { default: module.ChatGalleryDrawer };
});
