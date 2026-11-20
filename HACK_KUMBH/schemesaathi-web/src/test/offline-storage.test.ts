import { describe, it, expect, beforeEach } from "vitest";
import { offlineStorage } from "../lib/offline-storage";

describe("Offline Storage & Sync Queue", () => {
  beforeEach(() => {
    offlineStorage.clearQueue();
  });

  it("enqueues answers when offline", () => {
    offlineStorage.enqueue({
      householdId: "hh_test_123",
      answers: { age: 62, gender: "FEMALE" },
    });

    const queue = offlineStorage.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].householdId).toBe("hh_test_123");
    expect(queue[0].answers.age).toBe(62);
  });

  it("clears queue upon request", () => {
    offlineStorage.enqueue({
      householdId: "hh_test_456",
      answers: { widow: true },
    });
    expect(offlineStorage.getQueue().length).toBe(1);
    offlineStorage.clearQueue();
    expect(offlineStorage.getQueue().length).toBe(0);
  });
});
