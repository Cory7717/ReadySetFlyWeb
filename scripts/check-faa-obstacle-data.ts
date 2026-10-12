import { createFaaObstacleDataService } from "../server/services/faaObstacleData";

async function main() {
  const memoryBefore = process.memoryUsage();
  const maxRssBeforeKiB = process.resourceUsage().maxRSS;
  const startedAt = Date.now();
  const result = await createFaaObstacleDataService().getData();
  const memoryAfter = process.memoryUsage();

  console.log(
    JSON.stringify(
      {
        elapsedMs: Date.now() - startedAt,
        recordCount: result.records.length,
        firstId: result.records[0]?.id || null,
        lastId: result.records.at(-1)?.id || null,
        referenceData: result.referenceData,
        memory: {
          rssBeforeBytes: memoryBefore.rss,
          rssAfterBytes: memoryAfter.rss,
          heapUsedBeforeBytes: memoryBefore.heapUsed,
          heapUsedAfterBytes: memoryAfter.heapUsed,
          maxRssBeforeKiB,
          maxRssAfterKiB: process.resourceUsage().maxRSS,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
