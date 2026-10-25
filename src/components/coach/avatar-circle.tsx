// A small deterministic-color initials avatar for list rows that have a
// name but no photo (chat contacts, etc.) — same name always gets the same
// color, so a returning contact stays visually recognizable across visits.
const PALETTE = [
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-emerald-500",
  "bg-indigo-500",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarCircle({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-7 w-7 text-[11px]" : "h-11 w-11 text-sm";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${dimension} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorForName(name)}`}
    >
      {initialsForName(name)}
    </div>
  );
}
