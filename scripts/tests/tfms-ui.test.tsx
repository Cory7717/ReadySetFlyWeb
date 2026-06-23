import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationalIntelligencePanelView } from "../../client/src/components/flight-planner/OperationalIntelligencePanel";

const baseProps = {
  status: null,
  risk: null,
  hasRoute: true,
  mapStyle: "standard",
  overlayEnabled: false,
  onToggleOverlay: () => {},
  onRetryStatus: () => {},
  isLoading: false,
  hasError: false,
};

test("TFMS panel renders upgrade state for free tier", () => {
  const html = renderToStaticMarkup(
    <OperationalIntelligencePanelView
      {...baseProps}
      tier="free"
    />
  );
  assert.ok(html.includes("Upgrade to Premium"));
});

test("TFMS panel renders alerts placeholder for Premium", () => {
  const html = renderToStaticMarkup(
    <OperationalIntelligencePanelView
      {...baseProps}
      tier="pro_plus"
    />
  );
  assert.ok(html.includes("No active TFMS advisories detected"));
});

test("TFMS panel renders overlay toggle for Premium", () => {
  const html = renderToStaticMarkup(
    <OperationalIntelligencePanelView
      {...baseProps}
      tier="pro_plus"
    />
  );
  assert.ok(html.includes("Congestion Overlay"));
});
