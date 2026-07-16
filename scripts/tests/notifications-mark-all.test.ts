import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const routesSource = readFileSync("server/routes.ts", "utf8");
const storageSource = readFileSync("server/storage.ts", "utf8");
const notificationsPageSource = readFileSync("client/src/pages/notifications.tsx", "utf8");

test("user notifications support mark all as read before single-id route", () => {
  const markAllIndex = routesSource.indexOf('app.patch("/api/notifications/mark-all-read"');
  const singleReadIndex = routesSource.indexOf('app.patch("/api/notifications/:id/read"');
  assert.ok(markAllIndex > -1, "expected mark-all-read route");
  assert.ok(singleReadIndex > -1, "expected single notification read route");
  assert.ok(markAllIndex < singleReadIndex, "mark-all-read must be registered before /:id/read");
  assert.match(routesSource, /markAllUserNotificationsRead\(userId\)/);
  assert.match(routesSource, /res\.json\(\{ updatedCount, count: 0 \}\)/);
});

test("storage marks only the current user's unread notifications as read", () => {
  assert.match(storageSource, /markAllUserNotificationsRead\(userId: string\): Promise<number>/);
  assert.match(storageSource, /eq\(userNotifications\.userId, userId\)/);
  assert.match(storageSource, /eq\(userNotifications\.isRead, false\)/);
  assert.match(storageSource, /set\(\{ isRead: true, readAt: new Date\(\) \}\)/);
});

test("notifications page exposes mark all as read and clears unread badge cache", () => {
  assert.match(notificationsPageSource, /Mark all as read/);
  assert.match(notificationsPageSource, /\/api\/notifications\/mark-all-read/);
  assert.match(notificationsPageSource, /button-mark-all-notifications-read/);
  assert.match(notificationsPageSource, /setQueryData<\{ count: number \}>\(\["\/api\/notifications\/unread"\], \{ count: 0 \}\)/);
  assert.match(notificationsPageSource, /invalidateQueries\(\{ queryKey: \["\/api\/notifications"\] \}\)/);
  assert.match(notificationsPageSource, /invalidateQueries\(\{ queryKey: \["\/api\/notifications\/unread"\] \}\)/);
});
