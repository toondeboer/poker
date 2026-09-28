import { describe, it, expect } from "vitest";
import {
  createSessionStorage,
  SHARED_SESSION_KEY,
  StoredSharedSession,
} from "./sessionStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";

const HOSTING: StoredSharedSession = { status: "hosting", code: "ABC234" };

describe("createSessionStorage", () => {
  it("has no session before anything is stored", async () => {
    const storage = createSessionStorage(createMemoryAdapter());
    expect(await storage.loadSharedSession()).toBeNull();
  });

  it("round-trips a hosted session", async () => {
    const storage = createSessionStorage(createMemoryAdapter());
    await storage.saveSharedSession(HOSTING);
    expect(await storage.loadSharedSession()).toEqual(HOSTING);
  });

  it("remembers hosting and joining apart", async () => {
    const storage = createSessionStorage(createMemoryAdapter());
    await storage.saveSharedSession({ status: "joined", code: "ABC234" });
    // A restarted host coming back as a guest would lose the right to publish,
    // which is the whole feature from that phone's side.
    expect((await storage.loadSharedSession())?.status).toBe("joined");
  });

  it("forgets the session when it is cleared", async () => {
    const storage = createSessionStorage(createMemoryAdapter());
    await storage.saveSharedSession(HOSTING);
    await storage.clearSharedSession();
    expect(await storage.loadSharedSession()).toBeNull();
  });

  it("reads corrupt JSON as no session rather than throwing", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(SHARED_SESSION_KEY, "{not json");
    expect(await createSessionStorage(adapter).loadSharedSession()).toBeNull();
  });

  it("rejects a stored value missing its code", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      SHARED_SESSION_KEY,
      JSON.stringify({ status: "hosting" }),
    );
    // A half-written value must never become a phone claiming to host a clock
    // that nobody else is in.
    expect(await createSessionStorage(adapter).loadSharedSession()).toBeNull();
  });

  it("rejects a status that is not hosting or joined", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      SHARED_SESSION_KEY,
      JSON.stringify({ status: "off", code: "ABC234" }),
    );
    expect(await createSessionStorage(adapter).loadSharedSession()).toBeNull();
  });

  it("reads an unavailable store as no session", async () => {
    const storage = createSessionStorage(createFailingAdapter());
    expect(await storage.loadSharedSession()).toBeNull();
  });

  it("never throws when the store refuses a write", async () => {
    const storage = createSessionStorage(createFailingAdapter());
    // Failing to remember must not fail the join that just succeeded.
    await expect(storage.saveSharedSession(HOSTING)).resolves.toBeUndefined();
    await expect(storage.clearSharedSession()).resolves.toBeUndefined();
  });
});
