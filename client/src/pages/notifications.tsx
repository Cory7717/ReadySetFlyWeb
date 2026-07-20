import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeNotificationMessage, summarizeProviderChangeDetails } from "@shared/provider-notification-format";
import { ProviderChangeSummaryView } from "@/components/flight-planner/ProviderChangeSummaryView";

type UserNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  referenceDate?: string | null;
  isRead?: boolean | null;
  createdAt?: string | null;
  readAt?: string | null;
};

function formatDisplayDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isFlightPlanNotification(type?: string) {
  return /^(flight_plan_|provider_sync)/.test(type || "");
}

function NotificationMessage({ notification }: { notification: UserNotification }) {
  const summary = summarizeProviderChangeDetails(notification.message);
  if (summary) return <ProviderChangeSummaryView summary={summary} />;

  return (
    <p className="text-sm text-muted-foreground">
      {sanitizeNotificationMessage(notification.message) || "Flight Service pushed an update for this flight plan."}
    </p>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [acknowledgedNotificationIds, setAcknowledgedNotificationIds] = useState<Set<string>>(() => new Set());
  const pendingAcknowledgementIds = useRef<Set<string>>(new Set());
  const [pendingNotificationIds, setPendingNotificationIds] = useState<Set<string>>(() => new Set());
  const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);

  const { data: notifications = [], isLoading } = useQuery<UserNotification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const displayNotifications = useMemo(
    () =>
      notifications.map((notification) =>
        acknowledgedNotificationIds.has(notification.id)
          ? { ...notification, isRead: true, readAt: notification.readAt || new Date(0).toISOString() }
          : notification,
      ),
    [acknowledgedNotificationIds, notifications],
  );
  const unreadCount = displayNotifications.filter((notification) => !notification.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
      return res.json();
    },
    onSuccess: (result: any, id) => {
      setAcknowledgementError(null);
      setAcknowledgedNotificationIds((current) => new Set(current).add(id));
      queryClient.setQueryData<UserNotification[]>(["/api/notifications"], (current = []) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, ...result, isRead: true, readAt: result?.readAt || new Date().toISOString() }
            : notification
        )
      );
      queryClient.setQueryData<{ count: number }>(["/api/notifications/unread"], (current) => ({
        count: typeof result?.unreadCount === "number"
          ? result.unreadCount
          : Math.max(0, (current?.count ?? unreadCount) - 1),
      }));
      if (result?.plan) {
        queryClient.setQueryData<any[]>(["/api/flight-plans"], (current = []) =>
          current.map((plan) => plan.id === result.plan.id ? result.plan : plan)
        );
        queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      setAcknowledgementError("Notification could not be marked read. Try again.");
    },
    onSettled: (_result, _error, id) => {
      if (!id) return;
      pendingAcknowledgementIds.current.delete(id);
      setPendingNotificationIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    },
  });

  const handleMarkRead = (id: string) => {
    if (pendingAcknowledgementIds.current.has(id) || markReadMutation.isPending) return;
    pendingAcknowledgementIds.current.add(id);
    setPendingNotificationIds((current) => new Set(current).add(id));
    markReadMutation.mutate(id);
  };

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/notifications/mark-all-read", {});
      return res.json();
    },
    onSuccess: () => {
      setAcknowledgedNotificationIds(new Set(notifications.map((notification) => notification.id)));
      queryClient.setQueryData<{ count: number }>(["/api/notifications/unread"], { count: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>
                Flight updates, provider changes, and account alerts.
                {!isLoading && unreadCount > 0 ? ` ${unreadCount} unread.` : ""}
              </CardDescription>
            </div>
            {!isLoading && unreadCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-notifications-read"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {markAllReadMutation.isPending ? "Marking..." : "Mark all as read"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {acknowledgementError && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {acknowledgementError}
            </div>
          )}
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading notifications…</div>
          ) : displayNotifications.length === 0 ? (
            <div className="text-sm text-muted-foreground">You’re all caught up.</div>
          ) : (
            <div className="space-y-4">
              {displayNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 space-y-2 ${notification.isRead ? "bg-background" : "bg-primary/5 border-primary/40"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{notification.title}</h3>
                      {!notification.isRead && <Badge variant="default">New</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDisplayDate(notification.createdAt || null)}
                    </div>
                  </div>
                  <NotificationMessage notification={notification} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    {!isFlightPlanNotification(notification.type) && notification.referenceDate && (
                      <div>Due: {formatDisplayDate(notification.referenceDate)}</div>
                    )}
                    {!notification.isRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={markReadMutation.isPending || pendingNotificationIds.has(notification.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark read
                      </Button>
                    )}
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
