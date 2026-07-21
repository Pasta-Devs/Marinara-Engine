import { useUIStore } from "../../stores/ui.store";
import { NoodleHome } from "./NoodleHome";
import { NoodlerHome } from "./NoodlerHome";

export function NoodleView() {
  const navigation = useUIStore((state) => state.noodleNavigation);
  const setNavigation = useUIStore((state) => state.setNoodleNavigation);

  if (navigation.mode === "private" || navigation.mode === "verification") {
    return <NoodlerHome navigation={navigation} onNavigate={setNavigation} />;
  }

  return <NoodleHome navigation={navigation} onNavigate={setNavigation} />;
}
