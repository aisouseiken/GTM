// 簡易レート制限（総当たり攻撃・過剰アクセスを防ぐ）。
//
// このファイルの役割：
//   「同じ相手からの短時間の連打」を制限します。例：ログインの総当たり、公開APIの叩きすぎ。
//   一定時間(windowMs)あたりの回数(max)を超えたら false を返し、呼び出し側で 429(Too Many Requests) にします。
//   ※インメモリ実装。本番で複数サーバーにする場合は Redis 等の共有ストアに置き換える。

interface Bucket {
  count: number;
  resetAt: number; // この時刻を過ぎたらカウントをリセット
}

// HMRやリクエスト跨ぎで消えないようグローバルに保持
const g = globalThis as unknown as { __gtmRate?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__gtmRate ??= new Map());

// key（例: "login:メール" や "v1search:APIキーID"）ごとに、windowMs の間に max 回まで許可する。
// 許可できたら true、上限超過なら false を返す。
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false; // 上限に達した → 拒否
  b.count += 1;
  return true;
}
