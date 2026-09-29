import { useEffect, useRef } from "react";
import type { MultiplayerAction, MultiplayerGuestState } from "@marinara-engine/shared";
import type { MultiplayerGuestLabels } from "./multiplayer-guest-labels";
import { connectMultiplayerGuestFrame, type MultiplayerGuestTheme } from "./multiplayer-guest-channel";

interface Props {
  state: MultiplayerGuestState;
  labels: MultiplayerGuestLabels;
  theme: MultiplayerGuestTheme;
  title: string;
  onAction: (action: MultiplayerAction) => Promise<boolean>;
  onProtocolError: () => void;
}

/** Presentation only: this component cannot make requests or load a peer URL. */
export function MultiplayerGuestFrame({ state, labels, theme, title, onAction, onProtocolError }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const connection = useRef<ReturnType<typeof connectMultiplayerGuestFrame> | null>(null);
  const latest = useRef({ state, labels, theme, onAction, onProtocolError });
  latest.current = { state, labels, theme, onAction, onProtocolError };

  useEffect(() => {
    connection.current?.update({ state, labels, theme });
  }, [state, labels, theme]);
  useEffect(() => () => connection.current?.close(), []);

  return (
    <iframe
      ref={frame}
      title={title}
      src="/api/multiplayer/guest-view"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
      className="h-full min-h-0 w-full flex-1 border-0"
      onLoad={() => {
        connection.current?.close();
        if (!frame.current) return;
        try {
          connection.current = connectMultiplayerGuestFrame(frame.current, {
            initial: { state: latest.current.state, labels: latest.current.labels, theme: latest.current.theme },
            onAction: (action) => latest.current.onAction(action),
            onError: () => latest.current.onProtocolError(),
          });
        } catch {
          latest.current.onProtocolError();
        }
      }}
    />
  );
}
