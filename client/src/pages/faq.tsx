import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    id: "why-subscription",
    question: "Why should I pay for a subscription?",
    answer:
      "Ready Set Fly stores and secures a large amount of data for your listings, logbook entries, documents, and messages so it is always accessible. That storage and availability creates ongoing infrastructure costs, and subscriptions keep the platform reliable and growing.",
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
      "Payments are processed securely through PayPal. The platform records the transaction history for both owners and renters.",
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
    <div className="container mx-auto py-10 px-4 max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">FAQ</h1>
        <p className="text-muted-foreground">
          Quick answers to common questions about Ready Set Fly.
        </p>
      </div>

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
    </div>
  );
}
