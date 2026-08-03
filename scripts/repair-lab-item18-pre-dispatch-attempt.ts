import { pool } from "../server/db";

const PLAN_ID = "932fe8fa-04cf-492b-abe4-0b19a47042b9";
const ATTEMPT_ID = "1aa04304-7f11-47ed-830b-06620ec7559a";
const APPLY = process.argv.includes("--apply");

const isGenuineProviderId = (value: unknown) => {
  const text = String(value || "").trim();
  return Boolean(text && !/^rsf-/i.test(text));
};

const client = await pool.connect();

try {
  await client.query("begin");

  const planResult = await client.query(
    `select id, filing_provider_plan_id, filing_status, filing_pending_action,
            filing_is_live, filing_provider_snapshot
       from flight_plans
      where id = $1
      for update`,
    [PLAN_ID],
  );
  const attemptResult = await client.query(
    `select id, flight_plan_id, action, status, status_reason, provider_plan_id,
            error_code, error_message, dispatched_at, completed_at
       from flight_service_provider_action_attempts
      where id = $1
      for update`,
    [ATTEMPT_ID],
  );

  if (planResult.rowCount !== 1 || attemptResult.rowCount !== 1) {
    throw new Error("The targeted plan and attempt must each exist exactly once.");
  }

  const beforePlan = planResult.rows[0];
  const beforeAttempt = attemptResult.rows[0];
  if (beforeAttempt.flight_plan_id !== PLAN_ID) {
    throw new Error("The targeted attempt does not belong to the targeted plan.");
  }
  if (
    isGenuineProviderId(beforePlan.filing_provider_plan_id) ||
    isGenuineProviderId(beforeAttempt.provider_plan_id)
  ) {
    throw new Error(
      "A genuine provider ID exists. No local reclassification was performed; use provider synchronization.",
    );
  }
  if (
    beforeAttempt.status !== "provider-outcome-unknown" ||
    beforeAttempt.status_reason !==
      "provider_transport_or_parse_error_after_dispatch" ||
    beforeAttempt.action !== "file" ||
    !/Other ICAO Information is not valid for Flight Service/i.test(
      String(beforeAttempt.error_message || ""),
    )
  ) {
    throw new Error("The attempt no longer matches the known Item 18 regression signature.");
  }
  if (beforePlan.filing_status !== "provider-outcome-unknown") {
    throw new Error("The plan is no longer in the expected uncertain local state.");
  }

  let changedAttempt: Record<string, unknown> | null = null;
  let changedPlan: Record<string, unknown> | null = null;

  if (APPLY) {
    const attemptUpdate = await client.query(
      `update flight_service_provider_action_attempts
          set status = 'failed-before-dispatch',
              status_reason = 'local_validation_failed_before_dispatch',
              error_code = 'LOCAL_VALIDATION_FAILED',
              dispatched_at = null,
              completed_at = now(),
              updated_at = now()
        where id = $1
          and flight_plan_id = $2
          and status = 'provider-outcome-unknown'
      returning id, flight_plan_id, action, status, status_reason,
                provider_plan_id, error_code, error_message, dispatched_at,
                completed_at`,
      [ATTEMPT_ID, PLAN_ID],
    );
    if (attemptUpdate.rowCount !== 1) {
      throw new Error("The targeted attempt update did not affect exactly one row.");
    }
    changedAttempt = attemptUpdate.rows[0];

    const planUpdate = await client.query(
      `update flight_plans
          set filing_provider_plan_id = case
                when filing_provider_plan_id ~* '^rsf-' then null
                else filing_provider_plan_id
              end,
              filing_status = 'draft',
              filing_pending_action = null,
              filing_is_live = false,
              filing_provider_snapshot = coalesce(filing_provider_snapshot, '{}'::jsonb)
                - 'providerOutcomeUnknown'
                - 'providerOutcomeUnknownAction'
                - 'providerOutcomeUnknownAt'
                - 'providerOutcomeUnknownReason',
              updated_at = now()
        where id = $1
          and filing_status = 'provider-outcome-unknown'
      returning id, filing_provider_plan_id, filing_status,
                filing_pending_action, filing_is_live,
                filing_provider_snapshot`,
      [PLAN_ID],
    );
    if (planUpdate.rowCount !== 1) {
      throw new Error("The targeted plan update did not affect exactly one row.");
    }
    changedPlan = planUpdate.rows[0];
    await client.query("commit");
  } else {
    await client.query("rollback");
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "applied" : "dry-run",
        outboundProviderRequestMade: false,
        target: { planId: PLAN_ID, attemptId: ATTEMPT_ID },
        providerIdAssessment: {
          planProviderId: beforePlan.filing_provider_plan_id || null,
          attemptProviderId: beforeAttempt.provider_plan_id || null,
          genuineProviderIdExists: false,
        },
        rowsChanged: APPLY ? { flightPlans: 1, providerActionAttempts: 1 } : {
          flightPlans: 0,
          providerActionAttempts: 0,
        },
        before: { plan: beforePlan, attempt: beforeAttempt },
        after: APPLY ? { plan: changedPlan, attempt: changedAttempt } : null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
