// Verticals セクション下部に置く、origami 風のスケルトン例カード3枚。
// 中央のカードに「対象を選ぶと例が表示されます」のヒントピルを重ねる。

function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-paper p-5">
      {/* 上部の見出しスケルトン */}
      <div className="h-2.5 w-1/2 rounded-full bg-line" />
      <div className="mt-2 h-2 w-2/3 rounded-full bg-line/70" />

      {/* 傾けたスケルトンテーブル */}
      <div className="mt-6 -mr-8 ml-2 rotate-[-4deg]">
        <div className="overflow-hidden rounded-lg border border-line bg-cream-100/40">
          {/* ヘッダ行 */}
          <div className="flex items-center gap-3 border-b border-line/70 px-3 py-2">
            {[10, 8, 8, 10].map((w, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-line" />
                <div className="h-1.5 rounded-full bg-line" style={{ width: `${w * 4}px` }} />
              </div>
            ))}
          </div>
          {/* データ行 */}
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

export function VerticalExamples() {
  return (
    <div className="relative mt-12 grid gap-5 md:grid-cols-3">
      <SkeletonCard />
      <div className="relative">
        <SkeletonCard />
        {/* 中央のヒントピル */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand shadow-[0_8px_30px_-10px_rgba(255,46,147,0.5)]">
            <span className="h-2 w-2 rounded-full bg-brand" />
            上で対象を選ぶと、実例が表示されます
          </span>
        </div>
      </div>
      <SkeletonCard />
    </div>
  );
}
