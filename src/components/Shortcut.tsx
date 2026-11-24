/** Keycap for the key that triggers the control it sits in. The control itself announces
    the key through aria-keyshortcuts, so the cap is decoration, hidden where there's no room. */
export function Shortcut({ keyName, className = '' }: { keyName: string; className?: string }) {
  return (
    <kbd aria-hidden className={`keycap ${className}`}>
      {keyName}
    </kbd>
  );
}
