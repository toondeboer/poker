import { describe, expect, it } from "vitest";
import { reconcileActivities } from "./activityReconciliation";

describe("reconcileActivities", () => {
  it("starts fresh when nothing is live", () => {
    expect(reconcileActivities({ activeIds: [], currentId: null })).toEqual({
      adoptId: null,
      endIds: [],
      createNew: true,
    });
  });

  it("keeps our activity and ends the strays around it", () => {
    expect(
      reconcileActivities({ activeIds: ["a", "b", "c"], currentId: "b" }),
    ).toEqual({ adoptId: "b", endIds: ["a", "c"], createNew: false });
  });

  it("keeps our activity untouched when it is the only one", () => {
    expect(
      reconcileActivities({ activeIds: ["a"], currentId: "a" }),
    ).toEqual({ adoptId: "a", endIds: [], createNew: false });
  });

  it("adopts the single survivor after a cold launch", () => {
    // The force-quit case: iOS kept the activity running, the app remembers
    // nothing. Adopting avoids ending a good card and immediately drawing
    // another in its place.
    expect(
      reconcileActivities({ activeIds: ["stale"], currentId: null }),
    ).toEqual({ adoptId: "stale", endIds: [], createNew: false });
  });

  it("ends everything and starts fresh when several are live and none is ours", () => {
    // Deliberately does NOT adopt activeIds[0]: ActivityKit documents no
    // ordering, so picking one risks keeping a stale card and ending the live
    // one — which is exactly what the previous implementation did.
    expect(
      reconcileActivities({ activeIds: ["x", "y", "z"], currentId: null }),
    ).toEqual({ adoptId: null, endIds: ["x", "y", "z"], createNew: true });
  });

  it("treats an id the platform has already dropped as owning nothing", () => {
    expect(
      reconcileActivities({ activeIds: ["a", "b"], currentId: "gone" }),
    ).toEqual({ adoptId: null, endIds: ["a", "b"], createNew: true });
  });

  it("starts fresh when we hold an id but nothing is live at all", () => {
    expect(
      reconcileActivities({ activeIds: [], currentId: "gone" }),
    ).toEqual({ adoptId: null, endIds: [], createNew: true });
  });

  describe("mustKeepOne — for callers that reconcile but cannot create", () => {
    it("keeps one instead of ending everything when none is ours", () => {
      expect(
        reconcileActivities({
          activeIds: ["x", "y", "z"],
          currentId: null,
          mustKeepOne: true,
        }),
      ).toEqual({ adoptId: "x", endIds: ["y", "z"], createNew: false });
    });

    it("still cannot conjure a card when nothing is live", () => {
      expect(
        reconcileActivities({
          activeIds: [],
          currentId: null,
          mustKeepOne: true,
        }),
      ).toEqual({ adoptId: null, endIds: [], createNew: true });
    });

    it("changes nothing when our own activity is live", () => {
      expect(
        reconcileActivities({
          activeIds: ["a", "b"],
          currentId: "a",
          mustKeepOne: true,
        }),
      ).toEqual({ adoptId: "a", endIds: ["b"], createNew: false });
    });

    it("never asks a caller that cannot create to create", () => {
      // The whole point: `createNew` may only be true when there was nothing to
      // keep. Anything else strands the user with no card.
      const failures: string[] = [];
      const pool = ["a", "b", "c", "d"];
      for (let mask = 0; mask < 1 << pool.length; mask++) {
        const activeIds = pool.filter((_, i) => mask & (1 << i));
        for (const currentId of [null, ...pool, "absent"]) {
          const plan = reconcileActivities({
            activeIds,
            currentId,
            mustKeepOne: true,
          });
          if (plan.createNew && activeIds.length > 0) {
            failures.push(
              `${JSON.stringify({ activeIds, currentId })} asked to create`,
            );
          }
        }
      }
      expect(failures).toEqual([]);
    });
  });

  it("never asks the caller to end the activity it just adopted", () => {
    // The invariant that makes the plan safe to execute in any order.
    const inputs: {
      activeIds: string[];
      currentId: string | null;
      mustKeepOne: boolean;
    }[] = [];
    const pool = ["a", "b", "c"];
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const activeIds = pool.filter((_, i) => mask & (1 << i));
      for (const currentId of [null, "a", "b", "c", "absent"]) {
        inputs.push({ activeIds, currentId, mustKeepOne: false });
        inputs.push({ activeIds, currentId, mustKeepOne: true });
      }
    }

    // Failures are collected and asserted once: an `expect` inside a sweep is
    // what timed a previous property test out in CI at 5s.
    const failures: string[] = [];
    for (const input of inputs) {
      const plan = reconcileActivities(input);
      const label = `${JSON.stringify(input)} -> ${JSON.stringify(plan)}`;

      if (plan.adoptId !== null && plan.endIds.includes(plan.adoptId)) {
        failures.push(`ends the adopted activity: ${label}`);
      }
      if (plan.createNew !== (plan.adoptId === null)) {
        failures.push(`createNew disagrees with adoptId: ${label}`);
      }
      // Every live activity must be accounted for — kept or ended. Leaving one
      // unmentioned is precisely how cards accumulate.
      const accounted = new Set([...plan.endIds, plan.adoptId ?? ""]);
      const orphan = input.activeIds.find((id) => !accounted.has(id));
      if (orphan !== undefined) {
        failures.push(`leaves ${orphan} live and unaccounted for: ${label}`);
      }
      // Nothing invented: we can only end things that actually exist.
      const invented = plan.endIds.find((id) => !input.activeIds.includes(id));
      if (invented !== undefined) {
        failures.push(`ends an activity that isn't live: ${label}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("leaves exactly one activity live in every case", () => {
    const failures: string[] = [];
    const pool = ["a", "b", "c", "d"];
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const activeIds = pool.filter((_, i) => mask & (1 << i));
      for (const currentId of [null, ...pool, "absent"]) {
        for (const mustKeepOne of [false, true]) {
          const plan = reconcileActivities({
            activeIds,
            currentId,
            mustKeepOne,
          });
          const survivors = activeIds.filter((id) => !plan.endIds.includes(id));
          const total = survivors.length + (plan.createNew ? 1 : 0);
          if (total !== 1) {
            failures.push(
              `${JSON.stringify({ activeIds, currentId, mustKeepOne })} leaves ${total}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
