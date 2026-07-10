import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Gift, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type MembershipPromotionSummary = {
  id: string;
  code: string;
  name: string;
  campaign: string | null;
  partnerName: string | null;
  source: string | null;
  membershipTier: string;
  membershipDurationMonths: number;
  maxTotalRedemptions: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  remainingUses: number | null;
  expiresAt: string | null;
  isActive: boolean;
  successMessage: string | null;
  redemptions: Array<{
    id: string;
    userId: string;
    userEmail: string | null;
    userFirstName: string | null;
    userLastName: string | null;
    redeemedAt: string;
    membershipStartsAt: string;
    membershipEndsAt: string;
  }>;
};

const defaultSuccessMessage = "Congratulations! Your Ready Set Fly Premium membership promotion has been applied.";

export default function MembershipPromotionsAdminPage() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    name: "",
    campaign: "",
    partnerName: "",
    source: "",
    membershipDurationMonths: "12",
    maxTotalRedemptions: "5",
    maxRedemptionsPerUser: "1",
    expiresAt: "",
    successMessage: defaultSuccessMessage,
    isActive: true,
  });

  const { data: promotions = [], isLoading: promotionsLoading } = useQuery<MembershipPromotionSummary[]>({
    queryKey: ["/api/admin/membership-promotions"],
    enabled: Boolean(user?.isSuperAdmin),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/membership-promotions", {
        ...form,
        benefitType: "complimentary_membership",
        membershipTier: "premium",
        membershipDurationMonths: Number(form.membershipDurationMonths),
        maxTotalRedemptions: form.maxTotalRedemptions ? Number(form.maxTotalRedemptions) : null,
        maxRedemptionsPerUser: Number(form.maxRedemptionsPerUser || 1),
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-promotions"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/membership-promotions/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-promotions"] });
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  if (!user?.isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>Super Admin Required</CardTitle>
            <CardDescription>Membership Promotions are restricted to Super Admin accounts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Membership Promotions</h1>
          <p className="text-sm text-muted-foreground">Create and manage membership promo codes separately from marketplace listing promo codes.</p>
        </div>
        <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Super Admin</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Create membership promotion</CardTitle>
          <CardDescription>Codes grant a time-bounded membership entitlement and do not create a PayPal subscription.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ABS2026WINNER" /></div>
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ABS Member Dinner Winner" /></div>
          <div className="space-y-2"><Label>Campaign</Label><Input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></div>
          <div className="space-y-2"><Label>Partner</Label><Input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} /></div>
          <div className="space-y-2"><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
          <div className="space-y-2"><Label>Expiration date</Label><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
          <div className="space-y-2"><Label>Duration months</Label><Input value={form.membershipDurationMonths} onChange={(e) => setForm({ ...form, membershipDurationMonths: e.target.value })} /></div>
          <div className="space-y-2"><Label>Total redemption limit</Label><Input value={form.maxTotalRedemptions} onChange={(e) => setForm({ ...form, maxTotalRedemptions: e.target.value })} /></div>
          <div className="space-y-2"><Label>Per-user limit</Label><Input value={form.maxRedemptionsPerUser} onChange={(e) => setForm({ ...form, maxRedemptionsPerUser: e.target.value })} /></div>
          <div className="flex items-center gap-2 pt-7"><Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })} /><Label>Active</Label></div>
          <div className="space-y-2 md:col-span-2"><Label>Success message</Label><Textarea value={form.successMessage} onChange={(e) => setForm({ ...form, successMessage: e.target.value })} rows={4} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create membership promotion"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {promotionsLoading ? (
          <div className="text-sm text-muted-foreground">Loading membership promotions...</div>
        ) : promotions.map((promotion) => (
          <Card key={promotion.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{promotion.name}</CardTitle>
                  <CardDescription>{promotion.partnerName || "No partner"} · {promotion.campaign || "No campaign"}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={promotion.isActive ? "default" : "outline"}>{promotion.isActive ? "Active" : "Inactive"}</Badge>
                  <Badge variant="secondary">{promotion.redemptionCount} redeemed</Badge>
                  <Badge variant="secondary">{promotion.remainingUses === null ? "Unlimited" : `${promotion.remainingUses} remaining`}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-sm">{promotion.code}</code>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(promotion.code)}><Copy className="mr-1 h-3 w-3" /> Copy</Button>
                <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: promotion.id, updates: { isActive: !promotion.isActive } })}>
                  {promotion.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
              <div className="grid gap-2 text-sm md:grid-cols-4">
                <div><span className="text-muted-foreground">Tier:</span> {promotion.membershipTier}</div>
                <div><span className="text-muted-foreground">Duration:</span> {promotion.membershipDurationMonths} months</div>
                <div><span className="text-muted-foreground">Max:</span> {promotion.maxTotalRedemptions ?? "Unlimited"}</div>
                <div><span className="text-muted-foreground">Expires:</span> {promotion.expiresAt ? new Date(promotion.expiresAt).toLocaleDateString() : "No expiration"}</div>
              </div>
              {promotion.redemptions.length > 0 && (
                <div className="rounded border p-3">
                  <div className="mb-2 text-sm font-medium">Redemptions</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {promotion.redemptions.map((redemption) => (
                      <div key={redemption.id}>
                        {(redemption.userFirstName || redemption.userLastName) ? `${redemption.userFirstName || ""} ${redemption.userLastName || ""}`.trim() : redemption.userEmail || redemption.userId}
                        {" "}· redeemed {new Date(redemption.redeemedAt).toLocaleString()} · ends {new Date(redemption.membershipEndsAt).toLocaleDateString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
