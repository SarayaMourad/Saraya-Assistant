type Props = { size?: number; strokeWidth?: number };

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
});

export function CoffeeIcon({ size = 28, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 10h2a3 3 0 0 1 0 6h-2"/><path d="M7 4c0 1-1 1-1 2M11 4c0 1-1 1-1 2"/></svg>;
}

export function EyeIcon({ size = 20, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

export function EyeOffIcon({ size = 20, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="m3 3 18 18"/><path d="M10.6 6.2A9.5 9.5 0 0 1 12 6c6 0 9.5 6 9.5 6a18 18 0 0 1-3.1 3.8"/><path d="M6.3 6.8C3.9 8.3 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.7-.3 3.8-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>;
}

export function BoxIcon({ size = 22, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></svg>;
}

export function ChatIcon({ size = 22, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-5.5 4v-4.4A2.5 2.5 0 0 1 4 12.5v-7Z"/></svg>;
}

export function GearIcon({ size = 22, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4V19a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 11H1.5a2 2 0 0 1 0-4h.2a2 2 0 0 0 1.4-3.4L3 3.5A2 2 0 1 1 5.8.7l.1.1A2 2 0 0 0 9.3-.6V-.5a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.9 7h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.5 4Z" transform="translate(0 2) scale(.83)"/></svg>;
}

export function PlusIcon({ size = 20, strokeWidth = 1.8 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="M12 5v14M5 12h14"/></svg>;
}

export function ArrowIcon({ size = 20, strokeWidth = 1.8 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="m5 12 14 0"/><path d="m13 6 6 6-6 6"/></svg>;
}

export function ChevronIcon({ size = 18, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="m9 5 7 7-7 7"/></svg>;
}

export function CloseIcon({ size = 20, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

export function PaperclipIcon({ size = 20, strokeWidth = 1.7 }: Props) {
  return <svg {...base(size, strokeWidth)}><path d="m20 11-7.5 7.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-7.5 7.5a2 2 0 0 1-3-3L14 7"/></svg>;
}
