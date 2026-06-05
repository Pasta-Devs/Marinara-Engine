import { useEffect } from "react";
import { useEnabledCoreModuleStyles, useIsCoreModuleEnabled } from "../hooks/use-core-modules";
import { CORE_MODULE_PLACEHOLDER_ID } from "../lib/core-module-registry";
import { CoreModulePlaceholder } from "../placeholder/CoreModulePlaceholder";

const STYLE_PREFIX = "marinara-core-module-";

export function CoreModuleRuntimeProvider() {
  const { data: styles = [] } = useEnabledCoreModuleStyles();
  const { data: placeholderEnabled } = useIsCoreModuleEnabled(CORE_MODULE_PLACEHOLDER_ID);

  useEffect(() => {
    document.querySelectorAll(`style[id^="${STYLE_PREFIX}"]`).forEach((element) => element.remove());

    for (const contribution of styles) {
      const style = document.createElement("style");
      style.id = `${STYLE_PREFIX}${contribution.moduleId}`;
      style.textContent = contribution.css;
      document.head.appendChild(style);
    }

    return () => {
      document.querySelectorAll(`style[id^="${STYLE_PREFIX}"]`).forEach((element) => element.remove());
    };
  }, [styles]);

  return <>{placeholderEnabled ? <CoreModulePlaceholder /> : null}</>;
}
