import test from "node:test";
import assert from "node:assert/strict";
import { visibleLifecycleActions } from "./test-utils";

test("closed plan does not expose operational lifecycle buttons", () => {
  const actions = visibleLifecycleActions({
    filingStatus: "closed",
    filingIsLive: true,
    filingProviderPlanId: "FS123",
  } as any);
  assert.deepEqual(actions, {
    file: false,
    amend: false,
    activate: false,
    cancel: false,
    close: false,
  });
});

test("filed VFR provider plan exposes amend activate and cancel only", () => {
  const actions = visibleLifecycleActions({
    filingStatus: "filed",
    filingIsLive: true,
    filingProviderPlanId: "FS123",
  } as any);
  assert.equal(actions.file, false);
  assert.equal(actions.amend, true);
  assert.equal(actions.activate, true);
  assert.equal(actions.cancel, true);
  assert.equal(actions.close, false);
});
