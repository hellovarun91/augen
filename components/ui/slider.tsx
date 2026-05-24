"use client";

// Premium slider: a styled native range (smooth, keyboard + touch for free) with
// a filled track. `bipolar` fills outward from the centre (for -1..1 tone scales).
export function Slider({
  value, onChange, min = 0, max = 1, step = 0.05,
  leftLabel, rightLabel, showValue = true, format, bipolar = false, ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  leftLabel?: string; rightLabel?: string;
  showValue?: boolean;
  format?: (v: number) => string;
  bipolar?: boolean;
  ariaLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const fillFrom = bipolar ? Math.min(50, pct) : 0;
  const fillTo = bipolar ? Math.max(50, pct) : pct;
  const base = "rgba(255,255,255,0.10)";
  const fill = "rgba(255,255,255,0.85)";
  const background = `linear-gradient(to right, ${base} 0%, ${base} ${fillFrom}%, ${fill} ${fillFrom}%, ${fill} ${fillTo}%, ${base} ${fillTo}%, ${base} 100%)`;

  return (
    <div className="space-y-1.5">
      {(leftLabel || rightLabel || showValue) && (
        <div className="flex items-center justify-between text-xs text-ink-300">
          <span>{leftLabel}</span>
          {showValue && <span className="text-ink-500 tabular-nums">{format ? format(value) : value.toFixed(2)}</span>}
          <span>{rightLabel}</span>
        </div>
      )}
      <input
        type="range" min={min} max={max} step={step} value={value}
        aria-label={ariaLabel || leftLabel}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="aug-slider"
        style={{ background }}
      />
    </div>
  );
}
