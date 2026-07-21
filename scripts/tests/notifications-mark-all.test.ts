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
  assert.match(routesSource, /const unreadAfterMarkAll = await storage\.getUnreadUserNotifications\(userId\)/);
  assert.match(routesSource, /res\.json\(\{ updatedCount, count: unreadAfterMarkAll\.length \}\)/);
});

test("storage marks only the current user's unread non-provider notifications as read", () => {
  assert.match(storageSource, /markAllUserNotificationsRead\(userId: string\): Promise<number>/);
  assert.match(storageSource, /eq\(userNotifications\.userId, userId\)/);
  assert.match(storageSource, /eq\(userNotifications\.isRead, false\)/);
  assert.match(storageSource, /userNotifications\.type} !~ '\^\(flight_alert\|flight_change\|provider_sync\|flight_plan_\)'/);
  assert.match(storageSource, /set\(\{ isRead: true, readAt: new Date\(\) \}\)/);
});

test("notifications page exposes mark all as read and clears unread badge cache", () => {
  assert.match(notificationsPageSource, /Mark all as read/);
  assert.match(notificationsPageSource, /\/api\/notifications\/mark-all-read/);
  assert.match(notificationsPageSource, /button-mark-all-notifications-read/);
  assert.match(notificationsPageSource, /setQueryData<\{ count: number \}>\(\["\/api\/notifications\/unread"\], \{ count: Number\(result\?\.count \?\? 0\) \}\)/);
  assert.match(notificationsPageSource, /invalidateQueries\(\{ queryKey: \["\/api\/notifications"\] \}\)/);
  assert.doesNotMatch(notificationsPageSource, /invalidateQueries\(\{ queryKey: \["\/api\/notifications\/unread"\] \}\)/);
});

test("provider notification read endpoint resolves review and notification atomically", () => {
  const singleReadRoute = routesSource.slice(routesSource.indexOf('app.patch("/api/notifications/:id/read"'));
  assert.match(singleReadRoute, /db\.transaction\(async \(tx\)/);
  assert.match(singleReadRoute, /eq\(userNotifications\.id, notificationId\)/);
  assert.match(singleReadRoute, /eq\(userNotifications\.userId, userId\)/);
  assert.match(singleReadRoute, /providerPendingReview:\s*false/);
  assert.match(singleReadRoute, /providerReviewAcceptedEffectivePlanHash/);
  assert.match(singleReadRoute, /flight_service_notification_acknowledge_started/);
  assert.match(singleReadRoute, /flight_service_notification_acknowledge_completed/);
  assert.match(singleReadRoute, /flight_service_notification_acknowledge_idempotent/);
  assert.match(singleReadRoute, /flight_service_notification_acknowledge_failed/);
});

test("notification acknowledgement updates unread and flight-plan caches after one click", () => {
  assert.match(notificationsPageSource, /setQueryData<UserNotification\[\]>\(\["\/api\/notifications"\]/);
  assert.match(notificationsPageSource, /notification\.id === id[\s\S]*isRead: true/);
  assert.match(notificationsPageSource, /setQueryData<\{ count: number \}>\(\["\/api\/notifications\/unread"\]/);
  assert.match(notificationsPageSource, /result\?\.unreadCount === "number"/);
  assert.match(notificationsPageSource, /Math\.max\(0, \(current\?\.count \?\? unreadCount\) - 1\)/);
  assert.match(notificationsPageSource, /setQueryData<any\[\]>\(\["\/api\/flight-plans"\]/);
  assert.match(notificationsPageSource, /invalidateQueries\(\{ queryKey: \["\/api\/flight-plans"\] \}\)/);
});

test("mark all read does not accept provider changes", () => {
  const markAllRoute = routesSource.slice(routesSource.indexOf('app.patch("/api/notifications/mark-all-read"'), routesSource.indexOf('app.patch("/api/notifications/:id/read"'));
  assert.match(markAllRoute, /markAllUserNotificationsRead\(userId\)/);
  assert.match(storageSource, /flight_alert\|flight_change\|provider_sync\|flight_plan_/);
  assert.doesNotMatch(markAllRoute, /providerPendingReview:\s*false/);
  assert.doesNotMatch(markAllRoute, /providerReviewAcceptedEffectivePlanHash/);
});

test("single notification acknowledgement requires current provider-review identity before clearing review", () => {
  const singleReadRoute = routesSource.slice(routesSource.indexOf('app.patch("/api/notifications/:id/read"'));
  assert.match(singleReadRoute, /providerReviewNotificationMatchesCurrentReview/);
  assert.match(singleReadRoute, /notificationEffectivePlanHash/);
  assert.match(singleReadRoute, /notificationVersionStamp/);
  assert.match(singleReadRoute, /stale_notification_acknowledged_newer_review_preserved/);
  assert.match(singleReadRoute, /newerReviewPreserved/);
  assert.match(singleReadRoute, /flight_service_notification_acknowledged_by_user/);
  assert.match(singleReadRoute, /source: "explicit_user_action"/);
  assert.doesNotMatch(singleReadRoute, /req\.(?:body|query|headers)\.userId/);
});
