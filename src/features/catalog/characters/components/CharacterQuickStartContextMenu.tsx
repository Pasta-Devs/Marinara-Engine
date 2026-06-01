import { MessageCircle, Wand2 } from "lucide-react";

import { ContextMenu, type ContextMenuItem } from "../../../../shared/components/ui/ContextMenu";

export type CharacterQuickStartContextMenuState = {
  x: number;
  y: number;
  charId: string;
  charName: string;
  firstMes?: string;
  altGreetings?: string[];
};

export function CharacterQuickStartContextMenu({
  menu,
  pendingStartCharacterId,
  onClose,
  onStartRoleplay,
  onStartConversation,
}: {
  menu: CharacterQuickStartContextMenuState;
  pendingStartCharacterId: string | null;
  onClose: () => void;
  onStartRoleplay: (menu: CharacterQuickStartContextMenuState) => void;
  onStartConversation: (menu: CharacterQuickStartContextMenuState) => void;
}) {
  const items: ContextMenuItem[] = [
    {
      label: "Quick Start Roleplay",
      icon: <Wand2 size="0.75rem" />,
      disabled: pendingStartCharacterId === menu.charId,
      onSelect: () => onStartRoleplay(menu),
    },
    {
      label: "Quick Start Conversation",
      icon: <MessageCircle size="0.75rem" />,
      onSelect: () => onStartConversation(menu),
    },
  ];

  return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={onClose} />;
}
