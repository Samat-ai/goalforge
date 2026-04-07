export const T = {
  bg: "#07070f", surface: "#0e0e1a", card: "#12121f",
  border: "#1c1c30", borderHi: "#2e2e50",
  orange: "#f97316", indigo: "#818cf8", emerald: "#34d399",
  rose: "#fb7185", amber: "#fbbf24", muted: "#71717a",
  dim: "#3f3f5c", text: "#e8e8f0", textDim: "#a0a0b8",
  serif: "'Plus Jakarta Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

// Light mode design tokens — used when .dark class is absent
export const TLight = {
  bg: "#ffffff", surface: "#f8fafc", card: "#f8fafc",
  border: "#e2e8f0", borderHi: "#cbd5e1",
  orange: "#f97316", indigo: "#6366f1", emerald: "#10b981",
  rose: "#f43f5e", amber: "#f59e0b", muted: "#94a3b8",
  dim: "#cbd5e1", text: "#0f172a", textDim: "#475569",
  serif: "'Plus Jakarta Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;
