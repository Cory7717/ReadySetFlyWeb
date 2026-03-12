import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const AUTHORIZED_EMAIL = "coryarmer@gmail.com";
const PDF_PATH = "/investor/RSF_Investor_Pitch_Deck.pdf";
const PPTX_PATH = "/investor/RSF_Investor_Pitch_Deck.pptx";
export const INVESTOR_DECK_SHARE_PATH = "/investor-deck/share/rsf-2026-deck";

function InvestorDeckContent({
  badge,
  description,
}: {
  badge: string;
  description: string;
}) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="space-y-2">
        <Badge variant="secondary" className="w-fit">{badge}</Badge>
        <h1 className="text-3xl font-bold">RSF Investor Deck</h1>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PDF Version</CardTitle>
            <CardDescription>Use for quick viewing and sharing.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <a href={PDF_PATH} target="_blank" rel="noopener noreferrer">
                Open PDF
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={PDF_PATH} download>
                Download PDF
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PowerPoint Version</CardTitle>
            <CardDescription>Use when you need the editable presentation.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <a href={PPTX_PATH} target="_blank" rel="noopener noreferrer">
                Open PPTX
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={PPTX_PATH} download>
                Download PPTX
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InvestorDeckPage() {
  const { user } = useAuth();
  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  const isAuthorized = normalizedEmail === AUTHORIZED_EMAIL;

  if (!isAuthorized) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">Restricted</Badge>
            <CardTitle>Investor Deck Access</CardTitle>
            <CardDescription>
              This page is only available to the authorized RSF account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Signed-in email does not have access to the investor deck.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <InvestorDeckContent
      badge="Private"
      description="Private access for investor materials. Both formats below are served directly from RSF."
    />
  );
}

export function InvestorDeckSharePage() {
  return (
    <InvestorDeckContent
      badge="Shared Link"
      description="Shared investor materials. Anyone with this link can view the deck files directly."
    />
  );
}
