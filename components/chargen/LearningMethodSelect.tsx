"use client";

import type { LearningMethod } from "@/lib/chargen/types";
import { LEARNING_METHOD_LABELS } from "@/lib/chargen/types";

const OPTIONS: LearningMethod[] = [
  "none",
  "mutual",
  "teacher",
  "self_study",
  "special_experience",
];

export default function LearningMethodSelect({
  value,
  onChange,
  className = "",
  exclude,
}: {
  value: LearningMethod;
  onChange: (v: LearningMethod) => void;
  className?: string;
  /** Omit options not offered on this panel (Java varies by tab). */
  exclude?: LearningMethod[];
}) {
  const filtered = OPTIONS.filter((o) => !exclude?.includes(o));
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-ink-muted">Method of Learning</span>
      <select
        className="mt-1 w-full max-w-xs rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
        value={value}
        onChange={(e) => onChange(e.target.value as LearningMethod)}
      >
        {filtered.map((o) => (
          <option key={o} value={o}>
            {LEARNING_METHOD_LABELS[o]}
          </option>
        ))}
      </select>
    </label>
  );
}
