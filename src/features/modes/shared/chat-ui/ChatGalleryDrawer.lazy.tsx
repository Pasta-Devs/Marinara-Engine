import { lazy } from "react";

export const ChatGalleryDrawer = lazy(async () => {
  const module = await import("./components/ChatGalleryDrawer");
  return { default: module.ChatGalleryDrawer };
});
