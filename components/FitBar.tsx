// Fit Score の緑バー（origami の緑グラデ棒を再現）
export function FitBar({ score }: { score: number }) {
  const color =
    score >= 88 ? "#7bc47f" : score >= 74 ? "#a7cf7d" : score >= 60 ? "#cfe08a" : "#e6c98a";
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 rounded-sm"
        style={{ width: `${Math.max(12, score * 0.34)}px`, background: color }}
      />
      <span className="tabular-nums text-ink-soft">{score}</span>
    </div>
  );
}

// 会社名の頭文字アバター（favicon 代替）
export function CompanyAvatar({ name }: { name: string }) {
  const ch = (name.replace(/[株式会社有限合同]/g, "").trim()[0] || name[0] || "?").toUpperCase();
  const palette = ["#ffd9ec", "#dbe8ff", "#e3f5df", "#fdead0", "#e9e2ff", "#d9f2f0"];
  const idx = name.charCodeAt(0) % palette.length;
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] text-[10px] font-semibold text-ink/70"
      style={{ background: palette[idx] }}
    >
      {ch}
    </span>
  );
}
