import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationsPage from "../../client/src/pages/notifications";
import { getQueryFn } from "../../client/src/lib/queryClient";

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  meta?: Record<string, unknown> | null;
};

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: getQueryFn({ on401: "throw" }),
        retry: false,
        staleTime: 0,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const textContent = (node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string => {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(textContent).join("");
  return node.children?.map((child) => typeof child === "string" ? child : textContent(child)).join("") || "";
};

const instanceText = (node: TestRenderer.ReactTestInstance): string =>
  node.children.map((child) => typeof child === "string" ? child : instanceText(child)).join("");

const findButtonByText = (root: TestRenderer.ReactTestRenderer, label: string) =>
  root.root.findAll(
    (node) => node.type === "button" && instanceText(node).includes(label),
  )[0];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
};

test("rendered notification acknowledgement is one-click, disables while pending, and stale refetch does not resurrect unread state", async () => {
  const notification: NotificationRecord = {
    id: "notification-a",
    title: "Provider changes detected",
    message: "Flight Service pushed an update for this flight plan.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:17.000Z",
    readAt: null,
  };
  const staleNotification = { ...notification, isRead: false, readAt: null };
  let markReadCalls = 0;
  let notificationGetCalls = 0;
  let unreadGetCalls = 0;
  const requests: Array<{ method: string; url: string; body?: BodyInit | null }> = [];
  const acknowledgement = deferred<Response>();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    requests.push({ method, url, body: init?.body });
    if (method === "GET" && url.endsWith("/api/notifications")) {
      notificationGetCalls += 1;
      return Response.json(notificationGetCalls === 1 ? [notification] : [staleNotification]);
    }
    if (method === "GET" && url.endsWith("/api/notifications/unread")) {
      unreadGetCalls += 1;
      return Response.json({ count: unreadGetCalls === 1 ? 1 : 1 });
    }
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-a/read")) {
      markReadCalls += 1;
      return acknowledgement.promise;
    }
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();

    assert.match(textContent(renderer!.toJSON()), /1 unread/);
    const markReadButton = findButtonByText(renderer!, "Acknowledge");
    assert.ok(markReadButton, "expected rendered Acknowledge button");

    await act(async () => {
      markReadButton.props.onClick();
      markReadButton.props.onClick();
    });
    await flush();

    assert.equal(markReadCalls, 1);
    assert.equal(findButtonByText(renderer!, "Acknowledging")?.props.disabled, true);
    assert.ok(requests.some((request) =>
      request.method === "PATCH" &&
      request.url.endsWith("/api/notifications/notification-a/read") &&
      request.body === "{}"
    ));
    assert.equal(requests.some((request) => /provider-sync|\/sync|provider-review/.test(request.url) && request.method !== "GET"), false);

    await act(async () => {
      acknowledgement.resolve(Response.json({
        ...notification,
        ok: true,
        isRead: true,
        readAt: "2026-07-16T22:31:19.000Z",
        unreadCount: 0,
        providerPendingReview: false,
        providerReviewCleared: true,
        resultReason: "current_provider_review_accepted",
        plan: {
          id: "plan-1",
          filingProviderSnapshot: {
            providerPendingReview: false,
          },
        },
      }));
      await acknowledgement.promise;
    });
    await flush();

    assert.equal(markReadCalls, 1);
    assert.doesNotMatch(textContent(renderer!.toJSON()), /1 unread/);
    assert.equal(findButtonByText(renderer!, "Acknowledged")?.props.disabled, true);

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications/unread"] });
    });
    await flush();

    assert.equal(markReadCalls, 1);
    assert.doesNotMatch(textContent(renderer!.toJSON()), /1 unread/);
    assert.equal(findButtonByText(renderer!, "Acknowledged")?.props.disabled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("acknowledgement failure reenables the rendered button and shows retry copy", async () => {
  const notification: NotificationRecord = {
    id: "notification-failed",
    title: "Provider changes detected",
    message: "Flight Service pushed an update for this flight plan.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:17.000Z",
    readAt: null,
  };
  const acknowledgement = deferred<Response>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "GET" && url.endsWith("/api/notifications")) return Response.json([notification]);
    if (method === "GET" && url.endsWith("/api/notifications/unread")) return Response.json({ count: 1 });
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-failed/read")) return acknowledgement.promise;
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();

    const markReadButton = findButtonByText(renderer!, "Acknowledge");
    await act(async () => {
      markReadButton.props.onClick();
    });
    await flush();
    assert.equal(findButtonByText(renderer!, "Acknowledging")?.props.disabled, true);

    await act(async () => {
      acknowledgement.resolve(new Response(JSON.stringify({ error: "failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }));
      await acknowledgement.promise;
    });
    await flush();

    assert.equal(findButtonByText(renderer!, "Retry Acknowledge")?.props.disabled, false);
    assert.match(textContent(renderer!.toJSON()), /Notification could not be marked read/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("remount after accepted acknowledgement remains resolved from server state", async () => {
  const unreadNotification: NotificationRecord = {
    id: "notification-remount",
    title: "Provider changes detected",
    message: "Flight Service pushed an update for this flight plan.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:17.000Z",
    readAt: null,
  };
  const readNotification = { ...unreadNotification, isRead: true, readAt: "2026-07-16T22:31:19.000Z" };
  let serverNotification = unreadNotification;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "GET" && url.endsWith("/api/notifications")) return Response.json([serverNotification]);
    if (method === "GET" && url.endsWith("/api/notifications/unread")) return Response.json({ count: serverNotification.isRead ? 0 : 1 });
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-remount/read")) {
      serverNotification = readNotification;
      return Response.json({ ...readNotification, ok: true, unreadCount: 0, providerReviewCleared: true });
    }
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();
    await act(async () => {
      findButtonByText(renderer!, "Acknowledge").props.onClick();
    });
    await flush();
    renderer!.unmount();

    const nextQueryClient = makeQueryClient();
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={nextQueryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();

    assert.doesNotMatch(textContent(renderer!.toJSON()), /1 unread/);
    assert.equal(findButtonByText(renderer!, "Acknowledge"), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("older acknowledgement response does not hide a newer provider-review notification", async () => {
  const older: NotificationRecord = {
    id: "notification-old",
    title: "Provider changes detected",
    message: "Older provider change.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:17.000Z",
    readAt: null,
  };
  const newer: NotificationRecord = {
    id: "notification-new",
    title: "Provider changes detected",
    message: "Newer provider change.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:19.000Z",
    readAt: null,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "GET" && url.endsWith("/api/notifications")) return Response.json([older, newer]);
    if (method === "GET" && url.endsWith("/api/notifications/unread")) return Response.json({ count: 2 });
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-old/read")) {
      return Response.json({
        ...older,
        ok: true,
        isRead: true,
        unreadCount: 1,
        newerReviewPreserved: true,
        providerPendingReview: true,
        resultReason: "stale_notification_acknowledged_newer_review_preserved",
        plan: {
          id: "plan-1",
          filingProviderSnapshot: {
            providerPendingReview: true,
            providerEffectivePlanHash: "newer-hash",
          },
        },
      });
    }
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    queryClient.setQueryData<any[]>(["/api/flight-plans"], [{
      id: "plan-1",
      filingProviderSnapshot: {
        providerPendingReview: true,
        providerEffectivePlanHash: "older-hash",
      },
    }]);
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();

    const olderAcknowledgeButton = renderer!.root.findByProps({
      "data-testid": "button-acknowledge-notification-notification-old",
    });
    await act(async () => {
      olderAcknowledgeButton.props.onClick();
    });
    await flush();

    assert.match(textContent(renderer!.toJSON()), /Newer provider change/);
    assert.equal(renderer!.root.findByProps({
      "data-testid": "button-acknowledge-notification-notification-new",
    }).props.disabled, false);
    assert.equal(
      (queryClient.getQueryData<any[]>(["/api/flight-plans"]) || [])[0]?.filingProviderSnapshot?.providerPendingReview,
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pending acknowledgement disables only the clicked notification", async () => {
  const first: NotificationRecord = {
    id: "notification-first",
    title: "Provider changes detected",
    message: "First provider change.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:17.000Z",
    readAt: null,
  };
  const second: NotificationRecord = {
    id: "notification-second",
    title: "Provider changes detected",
    message: "Second provider change.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-16T22:31:18.000Z",
    readAt: null,
  };
  const acknowledgement = deferred<Response>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "GET" && url.endsWith("/api/notifications")) return Response.json([first, second]);
    if (method === "GET" && url.endsWith("/api/notifications/unread")) return Response.json({ count: 2 });
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-first/read")) return acknowledgement.promise;
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();

    const buttons = renderer!.root.findAll((node) => node.type === "button" && instanceText(node).includes("Acknowledge"));
    assert.equal(buttons.length, 2);
    await act(async () => {
      buttons[0].props.onClick();
    });
    await flush();

    const pendingButton = findButtonByText(renderer!, "Acknowledging");
    const idleButton = findButtonByText(renderer!, "Acknowledge");
    assert.equal(pendingButton.props.disabled, true);
    assert.equal(idleButton.props.disabled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider ACK and ROGERED text renders unacknowledged and does not call PATCH until clicked", async () => {
  const notification: NotificationRecord = {
    id: "notification-provider-ack",
    title: "Provider sync update",
    message: "ACK FPL/007 received. ARTCC state ROGERED. Provider lifecycle PROPOSED.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-21T18:00:00.000Z",
    readAt: null,
    meta: {
      providerEventHash: "event-ack-rogered",
      providerVersionStamp: "20260721180000000",
      providerPendingReview: false,
      changedFields: [],
    },
  };
  let patchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "GET" && url.endsWith("/api/notifications")) return Response.json([notification]);
    if (method === "GET" && url.endsWith("/api/notifications/unread")) return Response.json({ count: 1 });
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-provider-ack/read")) {
      patchCalls += 1;
      return Response.json({ ...notification, ok: true, isRead: true, readAt: "2026-07-21T18:00:01.000Z", unreadCount: 0 });
    }
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();

    assert.equal(patchCalls, 0);
    assert.match(textContent(renderer!.toJSON()), /1 unread/);
    assert.equal(findButtonByText(renderer!, "Acknowledge")?.props.disabled, false);

    await act(async () => {
      findButtonByText(renderer!, "Acknowledge").props.onClick();
    });
    await flush();
    assert.equal(patchCalls, 1);
    assert.equal(findButtonByText(renderer!, "Acknowledged")?.props.disabled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("same notification id with a new provider event identity resets to Acknowledge", async () => {
  const firstEvent: NotificationRecord = {
    id: "notification-reused",
    title: "Provider sync update",
    message: "First provider event.",
    type: "flight_alert",
    isRead: false,
    createdAt: "2026-07-21T18:00:00.000Z",
    readAt: null,
    meta: {
      providerEventHash: "event-first",
      providerVersionStamp: "20260721180000000",
      providerPendingReview: false,
      changedFields: [],
    },
  };
  const secondEvent = {
    ...firstEvent,
    message: "Second provider event.",
    isRead: false,
    readAt: null,
    createdAt: "2026-07-21T18:05:00.000Z",
    meta: {
      providerEventHash: "event-second",
      providerVersionStamp: "20260721180500000",
      providerPendingReview: false,
      changedFields: [],
    },
  };
  let currentNotification: NotificationRecord = firstEvent;
  let patchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "GET" && url.endsWith("/api/notifications")) return Response.json([currentNotification]);
    if (method === "GET" && url.endsWith("/api/notifications/unread")) return Response.json({ count: currentNotification.isRead ? 0 : 1 });
    if (method === "PATCH" && url.endsWith("/api/notifications/notification-reused/read")) {
      patchCalls += 1;
      currentNotification = { ...currentNotification, isRead: true, readAt: "2026-07-21T18:00:01.000Z" };
      return Response.json({ ...currentNotification, ok: true, unreadCount: 0 });
    }
    throw new Error(`Unexpected request in test: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const queryClient = makeQueryClient();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>,
      );
    });
    await flush();
    await act(async () => {
      findButtonByText(renderer!, "Acknowledge").props.onClick();
    });
    await flush();
    assert.equal(patchCalls, 1);
    assert.equal(findButtonByText(renderer!, "Acknowledged")?.props.disabled, true);

    currentNotification = secondEvent;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications/unread"] });
    });
    await flush();

    assert.match(textContent(renderer!.toJSON()), /Second provider event/);
    assert.match(textContent(renderer!.toJSON()), /1 unread/);
    assert.equal(findButtonByText(renderer!, "Acknowledge")?.props.disabled, false);
    assert.equal(findButtonByText(renderer!, "Acknowledged"), undefined);
    assert.equal(patchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
