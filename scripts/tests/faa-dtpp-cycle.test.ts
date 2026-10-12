import assert from "node:assert/strict";
import test from "node:test";
import {
  createFaaDtppCycleManager,
  parseFaaDtppCycleListings,
  parseFaaDtppMetadataUrls,
  resolveFaaDtppEnvironmentOverride,
  selectEffectiveFaaDtppCycle,
  type FaaDtppPersistedState,
} from "../../server/services/faaDtppCycle";

const SEARCH_HTML = `
  <select id="cycle" name="cycle">
    <option value="2610" selected>2610 (current) 0901Z October 01 to 0901Z October 29, 2026</option>
    <option value="2611">2611 (next) 0901Z October 29 to 0901Z November 26, 2026</option>
  </select>
  <a href="https://aeronav.faa.gov/d-tpp/2610/xml_data/d-tpp_Metafile.xml">Current XML</a>
  <a href="https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml">Next XML</a>`;

function xml(cycle: string, from: string, to: string, pdf = "01234TEST.PDF") {
  return `<digital_tpp cycle="${cycle}" from_edate="0901Z  ${from}" to_edate="0901Z  ${to}">
    <state_code ID="TX"><city_name ID="AUSTIN"><airport_name apt_ident="AUS" icao_ident="KAUS">
      <record><chart_code>IAP</chart_code><chart_name>RNAV RWY 18L</chart_name><pdf_name>${pdf}</pdf_name></record>
    </airport_name></city_name></state_code></digital_tpp>`;
}

function successfulFetch(overrides: { missingPdfCycle?: string; corruptXmlCycle?: string } = {}) {
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method || "GET"} ${url}`);
    if (url.includes("/dtpp/search")) return new Response(SEARCH_HTML, { status: 200 });
    const cycle = url.match(/\/d-tpp\/(\d{4})\//)?.[1];
    if (/d-tpp_metafile\.xml$/i.test(url)) {
      if (cycle === overrides.corruptXmlCycle) return new Response("<broken>", { status: 200 });
      return new Response(
        cycle === "2611"
          ? xml("2611", "10/29/26", "11/26/26")
          : xml("2610", "10/01/26", "10/29/26"),
        { status: 206 },
      );
    }
    if (init?.method === "HEAD" && url.endsWith(".PDF")) {
      return new Response(null, {
        status: cycle === overrides.missingPdfCycle ? 404 : 200,
        headers: { "content-type": "application/pdf", "content-length": "300000" },
      });
    }
    throw new Error(`Unexpected test URL: ${url}`);
  };
  return { fetchImpl, calls };
}

test("FAA publication metadata selects 2610 on October 12 and not future 2611", async () => {
  const listings = parseFaaDtppCycleListings(SEARCH_HTML);
  const selected = selectEffectiveFaaDtppCycle(listings, Date.parse("2026-10-12T12:00:00Z"));
  assert.equal(selected.active.cycle, "2610");
  assert.equal(selected.next?.cycle, "2611");
});

test("FAA publication metadata URLs preserve the exact lowercase published filename", () => {
  const urls = parseFaaDtppMetadataUrls(SEARCH_HTML);
  assert.equal(
    urls.get("2610"),
    "https://aeronav.faa.gov/d-tpp/2610/xml_data/d-tpp_Metafile.xml",
  );
  assert.equal(
    urls.get("2611"),
    "https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml",
  );
});

test("automatic manager validates active and future cycles but activates only the effective cycle", async () => {
  const mock = successfulFetch();
  const manager = createFaaDtppCycleManager({
    env: {}, fetchImpl: mock.fetchImpl, now: () => Date.parse("2026-10-12T12:00:00Z"), logger: () => {},
  });
  const result = await manager.getActiveCycle();
  assert.equal(result.cycle, "2610");
  assert.equal(result.status, "current");
  assert.equal(result.provenance, "faa-auto");
  assert.deepEqual(result.nextCycle, {
    cycle: "2611", effectiveFrom: "2026-10-29T09:01:00.000Z",
    effectiveTo: "2026-11-26T09:01:00.000Z", faaLabel: "next", ready: true, validationError: null,
  });
  assert.ok(mock.calls.includes(
    "GET https://aeronav.faa.gov/d-tpp/2610/xml_data/d-tpp_Metafile.xml",
  ));
  assert.ok(mock.calls.includes(
    "GET https://aeronav.faa.gov/d-tpp/2611/xml_data/d-tpp_Metafile.xml",
  ));
  assert.ok(mock.calls.includes("HEAD https://aeronav.faa.gov/d-tpp/2610/01234TEST.PDF"));
});

test("automatic manager rolls to 2611 at its effective boundary", async () => {
  const mock = successfulFetch();
  const manager = createFaaDtppCycleManager({
    env: {}, fetchImpl: mock.fetchImpl, now: () => Date.parse("2026-10-29T09:01:00Z"), logger: () => {},
  });
  assert.equal((await manager.getActiveCycle()).cycle, "2611");
});

test("a corrupt future XML or missing future PDF never activates early", async () => {
  for (const failure of [{ corruptXmlCycle: "2611" }, { missingPdfCycle: "2611" }]) {
    const mock = successfulFetch(failure);
    const manager = createFaaDtppCycleManager({
      env: {}, fetchImpl: mock.fetchImpl, now: () => Date.parse("2026-10-12T12:00:00Z"), logger: () => {},
    });
    const result = await manager.getActiveCycle();
    assert.equal(result.cycle, "2610");
    assert.equal(result.nextCycle?.ready, false);
    assert.ok(result.nextCycle?.validationError);
  }
});

test("corrupt active XML and missing active PDFs are rejected", async () => {
  for (const failure of [{ corruptXmlCycle: "2610" }, { missingPdfCycle: "2610" }]) {
    const mock = successfulFetch(failure);
    const manager = createFaaDtppCycleManager({
      env: {}, fetchImpl: mock.fetchImpl, now: () => Date.parse("2026-10-12T12:00:00Z"), logger: () => {},
    });
    await assert.rejects(manager.getActiveCycle(), /XML root was invalid|representative PDF request failed/);
  }
});

test("active XML and representative PDF HTTP failures include safe actionable diagnostics", async () => {
  const events: Record<string, unknown>[] = [];
  let resolveLogged!: () => void;
  const logged = new Promise<void>((resolve) => { resolveLogged = resolve; });
  const xml404 = createFaaDtppCycleManager({
    env: {},
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    logger: (event) => {
      events.push(event);
      resolveLogged();
    },
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.includes("/dtpp/search")) return new Response(SEARCH_HTML, { status: 200 });
      if (/d-tpp_metafile\.xml$/i.test(url)) return new Response("missing", { status: 404 });
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  xml404.start();
  await logged;
  xml404.stop();
  assert.deepEqual(events.at(-1), {
    event: "faa_dtpp_cycle_initialization_failed",
    error: "FAA d-TPP active-metadata-xml request failed (404) [aeronav.faa.gov/d-tpp/2610/xml_data/d-tpp_Metafile.xml]",
    stage: "active-metadata-xml",
    hostname: "aeronav.faa.gov",
    pathname: "/d-tpp/2610/xml_data/d-tpp_Metafile.xml",
    status: 404,
    redirected: false,
  });

  const pdf404 = createFaaDtppCycleManager({
    env: {},
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    logger: () => {},
    fetchImpl: successfulFetch({ missingPdfCycle: "2610" }).fetchImpl,
  });
  await assert.rejects(
    pdf404.getActiveCycle(),
    /representative PDF request failed \(404\).*aeronav\.faa\.gov\/d-tpp\/2610\/01234TEST\.PDF/,
  );
});

test("cycle discovery timeout aborts the upstream operation", async () => {
  const fetchImpl: typeof fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  const manager = createFaaDtppCycleManager({
    env: {}, fetchImpl, timeoutMs: 5,
    now: () => Date.parse("2026-10-12T12:00:00Z"), logger: () => {},
  });
  await assert.rejects(manager.getActiveCycle(), /discovery-html request failed: aborted/);
});

test("network failure retains explicitly stale last-known-good data and deduplicates refresh", async () => {
  let now = Date.parse("2026-10-12T12:00:00Z");
  let fail = false;
  const base = successfulFetch();
  let searchCalls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    if (String(input).includes("/dtpp/search")) searchCalls++;
    if (fail) throw new Error("network unavailable");
    return base.fetchImpl(input, init);
  };
  const manager = createFaaDtppCycleManager({ env: {}, fetchImpl, now: () => now, logger: () => {} });
  assert.equal((await manager.getActiveCycle()).status, "current");
  fail = true;
  now = Date.parse("2026-10-29T09:01:00Z");
  const [one, two] = await Promise.all([manager.getActiveCycle(), manager.getActiveCycle()]);
  assert.equal(one.cycle, "2610");
  assert.equal(one.status, "stale");
  assert.equal(two.stale, true);
  assert.equal(searchCalls, 2);
});

test("startup failure restores persisted cycle-specific data as explicitly stale", async () => {
  const persisted: FaaDtppPersistedState = {
    cycle: "2610",
    effectiveFrom: "2026-10-01T09:01:00.000Z",
    effectiveTo: "2026-10-29T09:01:00.000Z",
    faaLabel: "current",
    metaUrl: "https://aeronav.faa.gov/d-tpp/2610/xml_data/d-tpp_Metafile.xml",
    pdfBaseUrl: "https://aeronav.faa.gov/d-tpp/2610",
    zipUrl: null,
    validatedAt: "2026-10-12T11:00:00.000Z",
    nextCycle: null,
  };
  const manager = createFaaDtppCycleManager({
    env: {},
    now: () => Date.parse("2026-10-12T12:00:00Z"),
    fetchImpl: async () => { throw new Error("network unavailable"); },
    loadPersisted: async () => persisted,
    logger: () => {},
  });
  const result = await manager.getActiveCycle();
  assert.equal(result.cycle, "2610");
  assert.equal(result.provenance, "last-known-good");
  assert.equal(result.status, "stale");
  assert.equal(result.stale, true);
  assert.match(result.warning || "", /last-known-good/i);
});

test("environment overrides reject mixed cycles, credentials, and conflicting ZIP dates", async () => {
  assert.throws(() => resolveFaaDtppEnvironmentOverride({
    FAA_DTPP_CYCLE: "2610",
    FAA_DTPP_META_URL: "https://aeronav.faa.gov/d-tpp/2611/xml_data/d-TPP_Metafile.xml",
  }), /conflicting cycles/);
  assert.throws(() => resolveFaaDtppEnvironmentOverride({
    FAA_DTPP_CYCLE: "2610", FAA_DTPP_META_URL: "https://user:secret@example.com/meta.xml",
  }), /credential-free HTTPS/);

  const mock = successfulFetch();
  const manager = createFaaDtppCycleManager({
    env: { FAA_DTPP_CYCLE: "2610", FAA_DTPP_ZIP_URL: "https://aeronav.faa.gov/d-tpp/26/DDTPPE_260903.zip" },
    fetchImpl: mock.fetchImpl, now: () => Date.parse("2026-10-12T12:00:00Z"), logger: () => {},
  });
  await assert.rejects(manager.getActiveCycle(), /effective date conflicts/);
});

test("the ZIP-only legacy setting does not disable automatic resolution", async () => {
  assert.equal(resolveFaaDtppEnvironmentOverride({ FAA_DTPP_ZIP_URL: "https://example.com/old.zip" }), null);
});
