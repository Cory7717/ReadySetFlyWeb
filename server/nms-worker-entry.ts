import { startNmsNotamWorker } from "./nms-notam-worker";

const started = startNmsNotamWorker();

if (!started) {
  console.error("[NMS worker] failed to start");
  process.exit(1);
}

console.log("[NMS worker] running");

process.on("uncaughtException", (error) => {
  console.error("[NMS worker] uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("[NMS worker] unhandled rejection:", error);
  process.exit(1);
});
