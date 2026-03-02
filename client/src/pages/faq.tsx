import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageShell } from "@/components/layout/PageShell";

const FAQS = [
  {
    id: "why-subscription",
    question: "Why should I pay for a subscription?",
    answer:
      "Most of RSF stays open for free so users can browse the marketplace, rentals, and core planning tools first. Paid plans are for pilots who want saved workflow, digital logbook depth, training history, and ongoing currency tracking.",
  },
  {
    id: "trial",
    question: "Do you offer a free trial?",
    answer:
      "Yes. RSF Pro monthly plans start with a 14-day free trial so you can test the full workflow before billing starts.",
  },
  {
    id: "what-included",
    question: "What is included with a listing subscription?",
    answer:
      "Your subscription keeps your listings live in search, maintains message history, and preserves listing data, documents, and analytics.",
  },
  {
    id: "cancel",
    question: "Can I cancel at any time?",
    answer:
      "Yes. You can cancel from your dashboard, and your existing data remains available to you.",
  },
  {
    id: "verification",
    question: "Why do I need to verify my account?",
    answer:
      "Verification keeps the marketplace safe and compliant. It reduces fraud and helps owners trust renter profiles.",
  },
  {
    id: "payments",
    question: "How are payments handled?",
    answer:
      "Payments are processed securely through PayPal Business/Commerce, a trusted global payments platform. The platform records the transaction history for both owners and renters.",
  },
  {
    id: "support",
    question: "How do I get support?",
    answer:
      "Use the Contact page or send a message through your dashboard. We respond as quickly as possible.",
  },
];

export default function FaqPage() {
  return (
    <PageShell
      kicker="Support"
      title="FAQ"
      description="Quick answers to common questions about Ready Set Fly."
      contentClassName="max-w-4xl space-y-6"
    >
      <Accordion type="single" collapsible className="space-y-3">
        {FAQS.map((item) => (
          <AccordionItem key={item.id} value={item.id} className="rounded-lg border">
            <AccordionTrigger className="px-4 py-3 text-left">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </PageShell>
  );
}
