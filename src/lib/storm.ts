export const STORM_STATUS = {
  SAFE: { label: "I'm safe", hint: "Power or not — you are accounted for." },
  NEED_HELP: { label: "I need help", hint: "Neighbors will see this on the roster." },
} as const;

export type StormStatus = keyof typeof STORM_STATUS;

export const STORM_RESOURCES = {
  POWER: { label: "Have power", icon: "⚡" },
  GENERATOR: { label: "Generator", icon: "🔌" },
  CHAINSAW: { label: "Chainsaw", icon: "🪚" },
  ROOM: { label: "Spare room", icon: "🛏️" },
  FREEZER: { label: "Working freezer", icon: "🧊" },
  OTHER: { label: "Other help", icon: "🤝" },
} as const;

export type StormResource = keyof typeof STORM_RESOURCES;

export function isStormStatus(v: string): v is StormStatus {
  return v === "SAFE" || v === "NEED_HELP";
}

export function isStormResource(v: string): v is StormResource {
  return v in STORM_RESOURCES;
}
