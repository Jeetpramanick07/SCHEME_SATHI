import { api } from "../api/client";

export interface PendingAnswerSync {
  id: string;
  householdId: string;
  memberId?: string;
  answers: Record<string, unknown>;
  timestamp: number;
}

const SYNC_QUEUE_KEY = "schemesaathi_sync_queue";

export const offlineStorage = {
  getQueue(): PendingAnswerSync[] {
    try {
      const data = localStorage.getItem(SYNC_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  enqueue(item: Omit<PendingAnswerSync, "id" | "timestamp">) {
    const queue = this.getQueue();
    const entry: PendingAnswerSync = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    queue.push(entry);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  },

  clearQueue() {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  },

  async flushQueue(): Promise<{ syncedCount: number; errors: number }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;
    const remaining: PendingAnswerSync[] = [];

    for (const item of queue) {
      try {
        await api.patchAnswers(item.householdId, {
          member_id: item.memberId,
          answers: item.answers,
        });
        syncedCount++;
      } catch (err) {
        errors++;
        remaining.push(item);
      }
    }

    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
    return { syncedCount, errors };
  },
};
