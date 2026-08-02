import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BriefingSubscriberAdmin({
  briefings,
}: {
  briefings: Array<any>;
}) {
  const [testEmail, setTestEmail] = useState("");
  const { data } = useQuery<any>({
    queryKey: ["/api/admin/aviation-briefings/subscribers"],
    queryFn: async () => {
      const r = await fetch(
        apiUrl("/api/admin/aviation-briefings/subscribers"),
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Unable to load subscribers");
      return r.json();
    },
  });
  const action = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: "send" | "test" }) => {
      const r = await apiRequest(
        "POST",
        `/api/admin/aviation-briefings/${id}/${type === "send" ? "send-announcement" : "test-announcement"}`,
        type === "test" ? { email: testEmail } : undefined,
      );
      return r.json();
    },
    onSuccess: (result, vars) => {
      alert(
        vars.type === "test"
          ? "Test email sent."
          : `Announcement complete: ${result.sent} sent, ${result.failed} failed, ${result.skipped} already delivered.`,
      );
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/aviation-briefings/subscribers"],
      });
    },
  });
  const subscribers = data?.subscribers || [],
    active = subscribers.filter((x: any) => x.status === "active").length,
    pending = subscribers.filter((x: any) => x.status === "pending").length,
    unsubscribed = subscribers.filter(
      (x: any) => x.status === "unsubscribed",
    ).length;
  return (
    <section className="mt-8 rounded-xl border border-[#526d94]/40 bg-[#0c1624] p-5">
      <h2 className="flex items-center text-2xl font-bold">
        <MailCheck className="mr-2 h-6 w-6 text-[#87b8f7]" />
        Aviation Briefings subscribers
      </h2>
      <p className="mt-1 text-sm text-[#9fb0c4]">
        Verified article notifications only. Subscriber addresses remain
        private.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Active" value={active} />
        <Metric label="Awaiting confirmation" value={pending} />
        <Metric label="Unsubscribed" value={unsubscribed} />
      </div>
      <div className="mt-5 flex max-w-xl gap-2">
        <Input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Test email address"
        />
        <span className="self-center text-xs text-[#8da0b8]">
          Choose an article below.
        </span>
      </div>
      <div className="mt-5 space-y-2">
        {briefings
          .filter((x) => x.status === "published")
          .map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-[#526d94]/30 pt-3"
            >
              <div>
                <b>{item.title}</b>
                <div className="text-xs text-[#8da0b8]">
                  {deliverySummary(data?.deliveries || [], item.id)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!testEmail || action.isPending}
                  onClick={() => action.mutate({ id: item.id, type: "test" })}
                >
                  Send test
                </Button>
                <Button
                  size="sm"
                  disabled={action.isPending}
                  onClick={() =>
                    confirm(
                      "Send this article to all active subscribers who have not already received it?",
                    ) && action.mutate({ id: item.id, type: "send" })
                  }
                >
                  Send/retry announcement
                </Button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-[#111e30] p-4">
      <div className="text-xs text-[#9fb0c4]">{label}</div>
      <b className="text-2xl">{value}</b>
    </div>
  );
}
function deliverySummary(rows: any[], id: string) {
  const own = rows.filter((x) => x.briefingId === id),
    sent = own.find((x) => x.status === "sent")?.count || 0,
    failed = own.find((x) => x.status === "failed")?.count || 0;
  return `${sent} sent${failed ? ` · ${failed} failed` : ""}`;
}
