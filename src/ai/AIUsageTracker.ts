import { AIUsageRecord } from "./types";

const STORAGE_KEY_RECORDS = "mdrawing_ai_usage_records_v1";
const STORAGE_KEY_DAILY = "mdrawing_ai_daily_stats_v1";

interface DailyStats {
  date: string; // YYYY-MM-DD
  requestCount: number;
  tokenCount: number;
}

export class AIUsageTracker {
  private records: AIUsageRecord[] = [];
  private sessionRequestCount: number = 0;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY_RECORDS);
        if (raw) {
          this.records = JSON.parse(raw);
          // Keep only records within the last 24 hours
          const oneDayAgo = Date.now() - 24 * 3600 * 1000;
          this.records = this.records.filter(
            (r) => new Date(r.timestamp).getTime() >= oneDayAgo
          );
        }
      }
    } catch {
      this.records = [];
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        // Keep at most 100 recent records
        const slice = this.records.slice(-100);
        window.localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(slice));
      }
    } catch {
      // LocalStorage might be disabled or full
    }
  }

  private getTodayString(): string {
    return new Date().toISOString().split("T")[0];
  }

  private getDailyStats(): DailyStats {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY_DAILY);
        if (raw) {
          const parsed: DailyStats = JSON.parse(raw);
          if (parsed.date === this.getTodayString()) {
            return parsed;
          }
        }
      }
    } catch {}
    return { date: this.getTodayString(), requestCount: 0, tokenCount: 0 };
  }

  private setDailyStats(stats: DailyStats) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(stats));
      }
    } catch {}
  }

  public recordUsage(record: AIUsageRecord): void {
    this.sessionRequestCount++;
    this.records.push(record);
    this.saveToStorage();

    const todayStats = this.getDailyStats();
    todayStats.requestCount++;
    todayStats.tokenCount += record.totalTokens || 0;
    this.setDailyStats(todayStats);
  }

  public getSessionRequestCount(): number {
    return this.sessionRequestCount;
  }

  public getDailyRequestCount(): number {
    return this.getDailyStats().requestCount;
  }

  public getDailyTokenCount(): number {
    return this.getDailyStats().tokenCount;
  }

  /**
   * Calculates rolling requests in the last 60 seconds (RPM protective estimation).
   */
  public getRollingRPM(): number {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    return this.records.filter(
      (r) => new Date(r.timestamp).getTime() >= oneMinuteAgo
    ).length;
  }

  /**
   * Calculates rolling tokens in the last 60 seconds (TPM protective estimation).
   */
  public getRollingTPM(): number {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    return this.records
      .filter((r) => new Date(r.timestamp).getTime() >= oneMinuteAgo)
      .reduce((sum, r) => sum + (r.totalTokens || 0), 0);
  }

  public getRecentRecords(limit: number = 20): AIUsageRecord[] {
    return [...this.records].reverse().slice(0, limit);
  }

  public clear(): void {
    this.records = [];
    this.sessionRequestCount = 0;
    this.saveToStorage();
  }
}
