import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BriefingSubscribe({ source = "article", compact = false }: { source?: string; compact?: boolean }) {
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [pending, setPending] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    trackEvent("aviation_briefings_subscription_started", { source });
    try {
      const response = await fetch(
        apiUrl("/api/aviation-briefings/subscriptions"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, name, source, company: "" }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error || "Unable to subscribe.");
      setSent(true);
      trackEvent("aviation_briefings_subscription_requested", { source });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to subscribe.");
      trackEvent("aviation_briefings_subscription_failed", { source });
      setPending(false);
    }
  }
  if (compact) {
    return (
      <section className="rounded-xl border border-[#55739b]/35 bg-[#0b1726] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 shrink-0 text-[#8dbbfa]" />
            <div>
              <h2 className="font-bold text-white">Get new Ready Set Fly Briefings by email</h2>
              <p className="text-sm text-[#9fb0c4]">A short preview and direct link whenever a new article is published.</p>
            </div>
          </div>
          {sent ? (
            <p className="text-sm font-semibold text-emerald-300">Check your inbox to confirm.</p>
          ) : (
            <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-md">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" required maxLength={320} aria-label="Email address" className="min-w-0 flex-1" />
              <Button disabled={pending || !email.trim()} className="bg-[#347edc] text-white">{pending ? "Sendingâ€¦" : "Subscribe"}</Button>
              <input className="hidden" tabIndex={-1} autoComplete="off" name="company" />
            </form>
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-[#55739b]/40 bg-[#0d1929] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-[#173963] p-3">
          <Mail className="h-6 w-6 text-[#8dbbfa]" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">
            Get the next Ready Set Fly Briefing
          </h2>
          <p className="mt-2 leading-7 text-[#aebdce]">
            Receive an email when a new briefing is published, including its
            featured image, a short preview, and a direct link to read it.
          </p>
          {sent ? (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-4 text-emerald-100">
              <b>Check your inbox.</b> Confirm your email address to begin
              receiving Ready Set Fly | Briefings.
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                maxLength={200}
                aria-label="Name"
              />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                required
                maxLength={320}
                aria-label="Email address"
              />
              <Button
                disabled={pending || !email.trim()}
                className="bg-[#347edc] text-white"
              >
                {pending ? "Sending…" : "Subscribe"}
              </Button>
              <input
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                name="company"
              />
              {error && (
                <p role="alert" className="text-sm text-red-300 sm:col-span-3">
                  {error}
                </p>
              )}
            </form>
          )}
          <p className="mt-3 text-xs text-[#8396ad]">
            Ready Set Fly | Briefings updates only. Confirmed opt-in required.
            Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  );
}
