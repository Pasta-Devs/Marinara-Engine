import { useState } from "react";
import { NoodleHome } from "./NoodleHome";
import { NoodlerHome } from "./NoodlerHome";
import type { NoodleNavigationState } from "./noodle-navigation.types";

export function NoodleView() {
  const [navigation, setNavigation] = useState<NoodleNavigationState>({ mode: "public", view: "home" });

  if (navigation.mode === "private" || navigation.mode === "verification") {
    return <NoodlerHome navigation={navigation} onNavigate={setNavigation} />;
  }

  return <NoodleHome navigation={navigation} onNavigate={setNavigation} />;
}
