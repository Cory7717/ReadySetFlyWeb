import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, MessageCircle, Send, X } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  fullName: string;
  email: string;
  companyName: string;
  propertyCount: string;
  message: string;
  website: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  companyName: "",
  propertyCount: "",
  message: "",
  website: "",
};

export default function PublicSalesInquiryWidget() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const update = (field: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await fetch(
        apiUrl("/api/hotel-operations/public/sales-inquiries"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({
            ...form,
            propertyCount: form.propertyCount
              ? Number(form.propertyCount)
              : null,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Unable to send your inquiry right now.");
      setReference(body.reference || "received");
      setForm(EMPTY_FORM);
    } catch {
      setError(
        "We couldn't send your inquiry right now. Please try again shortly.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open INNTRIX sales inquiry form"
        aria-haspopup="dialog"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#174d45] px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-[#173e37]/20 transition hover:bg-[#103c35] focus:outline-none focus:ring-2 focus:ring-[#c79a4f] focus:ring-offset-2"
      >
        <MessageCircle size={18} aria-hidden="true" />
        <span className="hidden sm:inline">Questions? Chat with us</span>
        <span className="sm:hidden">Questions?</span>
      </button>

      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="inntrix-sales-title"
          className="fixed bottom-4 right-4 z-50 flex max-h-[min(720px,calc(100vh-2rem))] w-[min(410px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[#d6cdbd] bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between bg-[#153f38] px-5 py-4 text-white">
            <div className="flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10">
                <Building2 size={18} aria-hidden="true" />
              </div>
              <div>
                <h2 id="inntrix-sales-title" className="font-semibold">
                  Questions about INNTRIX?
                </h2>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  Send our sales team a message. We&apos;ll follow up by email.
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close sales inquiry form"
              className="rounded-lg p-1 text-white/75 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d8b36f]"
            >
              <X size={20} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {reference ? (
              <div className="py-8 text-center" aria-live="polite">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e2eee9] text-[#174d45]">
                  <Send size={20} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Inquiry received</h3>
                <p className="mt-2 text-sm leading-6 text-[#63716c]">
                  Thank you for contacting INNTRIX. Our team will follow up using the business email you provided.
                </p>
                {reference !== "received" && (
                  <p className="mt-3 text-xs text-[#7a8581]">
                    Reference: {reference}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6"
                  onClick={() => {
                    setReference("");
                    setOpen(false);
                  }}
                >
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="sales-full-name">Full name</Label>
                  <Input id="sales-full-name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} autoComplete="name" minLength={2} maxLength={120} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sales-email">Business email</Label>
                  <Input id="sales-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" maxLength={320} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sales-company">Hotel or management company</Label>
                  <Input id="sales-company" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} autoComplete="organization" minLength={2} maxLength={200} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sales-properties">Number of properties <span className="font-normal text-[#77837f]">(optional)</span></Label>
                  <Input id="sales-properties" type="number" min={1} max={10000} step={1} value={form.propertyCount} onChange={(event) => update("propertyCount", event.target.value)} inputMode="numeric" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sales-message">How can we help?</Label>
                  <textarea id="sales-message" value={form.message} onChange={(event) => update("message", event.target.value)} minLength={10} maxLength={4000} rows={5} required className="resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <label className="absolute -left-[10000px]" aria-hidden="true">
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
                </label>
                {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
                <Button disabled={sending} className="bg-[#174d45] hover:bg-[#103c35]">
                  {sending ? "Sending…" : "Send inquiry"} <Send size={15} />
                </Button>
                <p className="text-[11px] leading-4 text-[#7b8682]">
                  Your information is used only to respond to this sales inquiry and is retained for a limited period. This is not live customer support.
                </p>
              </form>
            )}
          </div>
        </section>
      )}
    </>
  );
}
