import { useEffect, useState } from "react";
import { hasWindow } from "./utils";

export function useIsMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() => (hasWindow() ? window.matchMedia("(max-width: 640px)").matches : false));
  useEffect(() => {
    if (!hasWindow()) return undefined;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}
