import assert from "node:assert/strict";
import test from "node:test";

import { createQualifiedExposureTracker } from "../../client/src/hooks/useQualifiedBannerImpression";

type ScheduledTask = { callback: () => void; cancelled: boolean; delayMs: number };

function createHarness() {
  const tasks: ScheduledTask[] = [];
  const qualified: string[] = [];
  const tracker = createQualifiedExposureTracker({
    schedule: (callback, delayMs) => {
      const task = { callback, cancelled: false, delayMs };
      tasks.push(task);
      return task as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: (timer) => {
      (timer as unknown as ScheduledTask).cancelled = true;
    },
    onQualified: (key) => {
      qualified.push(key);
    },
  });

  const runPending = () => {
    for (const task of tasks.splice(0)) {
      if (!task.cancelled) task.callback();
    }
  };

  return { tracker, qualified, runPending, tasks };
}

test("qualifies one continuous visible exposure only once", () => {
  const { tracker, qualified, runPending, tasks } = createHarness();
  tracker.setExposure("home:ad-1:1");
  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  assert.equal(tasks[0]?.delayMs, 1000);
  runPending();
  tracker.setElementVisible(true);
  runPending();

  assert.deepEqual(qualified, ["home:ad-1:1"]);
});

test("cancels qualification when the element or document becomes hidden", () => {
  const { tracker, qualified, runPending } = createHarness();
  tracker.setExposure("home:ad-1:1");
  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  tracker.setDocumentVisible(false);
  runPending();
  assert.deepEqual(qualified, []);

  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  tracker.setElementVisible(false);
  runPending();
  assert.deepEqual(qualified, []);
});

test("restarts an interrupted qualification without recounting a completed exposure", () => {
  const { tracker, qualified, runPending } = createHarness();
  tracker.setExposure("home:ad-1:1");
  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  tracker.setElementVisible(false);
  runPending();

  tracker.setElementVisible(true);
  runPending();
  assert.deepEqual(qualified, ["home:ad-1:1"]);

  tracker.setDocumentVisible(false);
  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  runPending();
  assert.deepEqual(qualified, ["home:ad-1:1"]);
});

test("a genuine new rotation can qualify a new impression", () => {
  const { tracker, qualified, runPending } = createHarness();
  tracker.setExposure("home:ad-1:1");
  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  runPending();

  tracker.setExposure("home:ad-2:2");
  tracker.setElementVisible(true);
  runPending();

  assert.deepEqual(qualified, ["home:ad-1:1", "home:ad-2:2"]);
});

test("changing exposure cancels a stale pending submission", () => {
  const { tracker, qualified, runPending } = createHarness();
  tracker.setExposure("home:ad-1:1");
  tracker.setDocumentVisible(true);
  tracker.setElementVisible(true);
  tracker.setExposure("home:ad-2:2");
  runPending();

  assert.deepEqual(qualified, []);
});
