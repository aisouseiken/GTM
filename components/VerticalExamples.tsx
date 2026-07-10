// この部品は、業種（Verticals）セクションの下に置く「見本カード」を作ります。
// まだ中身が無い状態を表す3枚の骨組みカード（スケルトン）を並べ、
// 真ん中に「上で対象を選ぶと実例が出ます」という案内ラベルを重ねます。
// ※スケルトン = 実データの前に表示する、灰色の枠だけの仮表示。

// Verticals セクション下部に置く、origami 風のスケルトン例カード3枚。
// 中央のカードに「対象を選ぶと例が表示されます」のヒントピルを重ねる。

// カード1枚ぶんの骨組み（見出しっぽい灰色バーと、表っぽい灰色の行）を描く。
function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-paper p-5">
      {/* 上部の見出しスケルトン */}
      <div className="h-2.5 w-1/2 rounded-full bg-line" />
      <div className="mt-2 h-2 w-2/3 rounded-full bg-line/70" />

      {/* 少し傾けて奥行きを出したスケルトンの表 */}
      <div className="mt-6 -mr-8 ml-2 rotate-[-4deg]">
        <div className="overflow-hidden rounded-lg border border-line bg-cream-100/40">
          {/* 表の見出し行（灰色バーを4つ並べて列見出しに見せる） */}
          <div className="flex items-center gap-3 border-b border-line/70 px-3 py-2">
            {/* 4つぶんの幅の数値を順に取り出し、四角＋横バーの見出しっぽい飾りを作る */}
            {[10, 8, 8, 10].map((w, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-line" />
                {/* 幅の数値(w)に応じて横バーの長さを変える */}
                <div className="h-1.5 rounded-full bg-line" style={{ width: `${w * 4}px` }} />
              </div>
            ))}
          </div>
          {/* 表のデータ行を4行ぶん作る（中身は灰色バーの仮表示） */}
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="flex items-center gap-3 border-b border-line/50 px-3 py-2 last:border-0">
              <div className="h-3 w-3 rounded bg-line/80" />
              <div className="h-1.5 w-10 rounded-full bg-line/70" />
              <div className="h-1.5 w-16 rounded-full bg-line/50" />
              <div className="ml-auto h-1.5 w-12 rounded-full bg-line/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 骨組みカードを3枚横に並べ、真ん中のカードには案内ラベルを重ねる部品。
export function VerticalExamples() {
  return (
    // 3枚のカードを横並び（画面が狭いと縦積み）にする入れ物。
    <div className="relative mt-12 grid gap-5 md:grid-cols-3">
      {/* 左のカード */}
      <SkeletonCard />
      {/* 中央のカードだけは、上に案内ラベルを重ねるため入れ物で包む */}
      <div className="relative">
        <SkeletonCard />
        {/* 中央のヒントピル（カードの真上に重ねて中央に配置。クリックは透過させる） */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand shadow-[0_8px_30px_-10px_rgba(255,46,147,0.5)]">
            {/* 左端の小さな丸い飾り */}
            <span className="h-2 w-2 rounded-full bg-brand" />
            上で対象を選ぶと、実例が表示されます
          </span>
        </div>
      </div>
      {/* 右のカード */}
      <SkeletonCard />
    </div>
  );
}
