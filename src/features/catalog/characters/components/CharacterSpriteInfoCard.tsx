export function CharacterSpriteInfoCard() {
  return (
    <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
      <h4 className="mb-1.5 text-xs font-semibold">How sprites work</h4>
      <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
        <li>
          • Upload sprites one by one, or use <strong className="text-[var(--foreground)]">Upload Folder</strong> to
          bulk-import a folder of PNGs (each filename = expression name, e.g. admiration.png → "admiration")
        </li>
        <li>
          • To make one expression randomly rotate between variants, use a shared prefix before an underscore, e.g.
          happy_01.png and happy_blush.png are offered to the agent as "happy"
        </li>
        <li>
          • Enable the <strong className="text-[var(--foreground)]">Expression Engine</strong> agent in the Agents panel
        </li>
        <li>• During roleplay, the agent will detect emotions and display the matching sprite</li>
        <li>• Sprites appear as VN-style overlays in the chat area</li>
      </ul>
    </div>
  );
}
