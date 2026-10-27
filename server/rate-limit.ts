type Bucket = { count: number; resetAt: number }

export class RateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(private now: () => number = Date.now) {}

  hit(key: string, limit: number, windowMs: number): boolean {
    const current = this.now()
    if (this.buckets.size > 10_000) this.prune(current)
    const bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= current) {
      this.buckets.set(key, { count: 1, resetAt: current + windowMs })
      return true
    }
    if (bucket.count >= limit) return false
    bucket.count += 1
    return true
  }

  private prune(current: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= current) this.buckets.delete(key)
    }
  }
}
