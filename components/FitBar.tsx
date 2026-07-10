// このファイルには小さな表示部品が2つあります。
// 1つ目 FitBar は「適合度スコア（Fit Score）」を、点数に応じた長さ・色の横棒で表す部品。
// 2つ目 CompanyAvatar は、会社名の頭文字を色付きの四角に入れた簡易アイコンを作る部品。

// Fit Score の緑バー（origami の緑グラデ棒を再現）
// score（点数）が高いほど濃い緑、低いほど黄色寄りになるよう色を選ぶ。
export function FitBar({ score }: { score: number }) {
  // 点数の高さで棒の色を段階的に決める（88以上=濃い緑 / 74以上=黄緑 / 60以上=薄い黄緑 / それ未満=黄色）。
  const color =
    score >= 88 ? "#7bc47f" : score >= 74 ? "#a7cf7d" : score >= 60 ? "#cfe08a" : "#e6c98a";
  return (
    <div className="flex items-center gap-2">
      {/* 点数に比例した長さの横棒（最低でも12ピクセルは確保する） */}
      <span
        className="inline-block h-3 rounded-sm"
        style={{ width: `${Math.max(12, score * 0.34)}px`, background: color }}
      />
      {/* 点数の数字表示 */}
      <span className="tabular-nums text-ink-soft">{score}</span>
    </div>
  );
}

// 会社名の頭文字アバター（favicon 代替）
// ※アバター = 名前の代わりに表示する小さな目印アイコン。
export function CompanyAvatar({ name }: { name: string }) {
  // 「株式会社」などの言葉を取り除き、前後の空白も消してから、先頭1文字を大文字にする。
  // （もし取れなければ名前の先頭、それも無ければ "?" を使う）
  const ch = (name.replace(/[株式会社有限合同]/g, "").trim()[0] || name[0] || "?").toUpperCase();
  // 背景に使う色の候補。会社ごとに違う色になるよう名前から番号を決める。
  const palette = ["#ffd9ec", "#dbe8ff", "#e3f5df", "#fdead0", "#e9e2ff", "#d9f2f0"];
  // 会社名の先頭文字を数値化し、色候補の数で割った余りを色の番号にする（同じ会社名なら毎回同じ色）。
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
