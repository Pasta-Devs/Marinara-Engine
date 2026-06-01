type NotificationAudioContext = AudioContext & { state: AudioContextState | "interrupted" };

let notificationAudioContext: NotificationAudioContext | null = null;

function getNotificationAudioContext(): NotificationAudioContext | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = (window.AudioContext ?? audioWindow.webkitAudioContext) as
    | (new () => NotificationAudioContext)
    | undefined;
  if (!AudioContextClass) return null;
  if (
    !notificationAudioContext ||
    notificationAudioContext.state === "closed" ||
    notificationAudioContext.state === "interrupted"
  ) {
    notificationAudioContext = new AudioContextClass();
  }
  return notificationAudioContext;
}

export function playNotificationPing() {
  try {
    const context = getNotificationAudioContext();
    if (!context) return;

    if (context.state === "suspended" || context.state === "interrupted") {
      void context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.03;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  } catch {
    /* notification audio is best-effort */
  }
}
