import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { AdminUserModal } from "@/components/admin-user-modal";

type AdminUserSummary = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | Date | null;
  isSuspended: boolean | null;
  membershipTier: string | null;
  membershipStatus: string | null;
  effectiveMembershipTier: "free" | "premium";
  marketingSubscribed: boolean;
  emailVerified: boolean | null;
  hasCfiProfile: boolean;
  aircraftCount: number;
  marketplaceCount: number;
};

type AdminUsersTableResponse = {
  totalMatched: number;
  rows: AdminUserSummary[];
};

type MarketingAudiencePreview = {
  audience: string;
  totalMatched: number;
  eligibleCount: number;
  skippedMissingEmail: number;
  skippedInvalidEmail: number;
  skippedOptedOut: number;
  skippedDuplicates: number;
  sampleRecipients: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
};

type MarketingSendResult = {
  audience: string;
  totalIntendedRecipients: number;
  totalSent: number;
  totalSkipped: number;
  skippedBreakdown: Record<string, number>;
  failedCount: number;
  failedEmails: Array<{ email: string; error: string }>;
};

const EMAIL_AUDIENCE_OPTIONS = [
  { value: "all_active", label: "All active users" },
  { value: "recently_joined", label: "Recently joined users" },
  { value: "free_users", label: "Free users only" },
  { value: "premium", label: "Premium users" },
  { value: "without_subscription", label: "Users without a subscription" },
  { value: "filtered_results", label: "Current filtered users" },
  { value: "selected_users", label: "Selected users" },
] as const;

const DEFAULT_SUBJECT = "A note from Ready Set Fly";

function buildQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value === "all") return;
    params.set(key, value);
  });
  return params.toString();
}

function formatTier(tier: AdminUserSummary["effectiveMembershipTier"]) {
  if (tier === "premium") return "Premium";
  return "Free";
}

export function AdminUsersManager() {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const [search, setSearch] = useState("");
  const [joinedPreset, setJoinedPreset] = useState("all");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [accountStatus, setAccountStatus] = useState("all");
  const [marketingStatus, setMarketingStatus] = useState("all");
  const [subscriptionTier, setSubscriptionTier] = useState("all");
  const [cfiProfile, setCfiProfile] = useState("all");
  const [aircraftOwner, setAircraftOwner] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [emailAudience, setEmailAudience] = useState<(typeof EMAIL_AUDIENCE_OPTIONS)[number]["value"]>("all_active");
  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState("");
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<MarketingSendResult | null>(null);
  const trimmedSearch = search.trim();
  const deferredSearch = useDeferredValue(trimmedSearch);
  const searchAllowsLookup =
    deferredSearch.includes("@") || deferredSearch.toLowerCase().startsWith("id:");
  const shouldLoadDirectory = deferredSearch.length >= 2 || searchAllowsLookup;

  const filters = useMemo(
    () => ({
      search: deferredSearch,
      joinedPreset,
      joinedFrom,
      joinedTo,
      accountStatus,
      marketingStatus,
      subscriptionTier,
      cfiProfile,
      aircraftOwner,
      sortBy,
      sortDirection,
    }),
    [
      deferredSearch,
      joinedPreset,
      joinedFrom,
      joinedTo,
      accountStatus,
      marketingStatus,
      subscriptionTier,
      cfiProfile,
      aircraftOwner,
      sortBy,
      sortDirection,
    ],
  );

  const {
    data,
    isLoading,
    isFetching,
    error: usersTableError,
  } = useQuery<AdminUsersTableResponse>({
    queryKey: ["/api/admin/users/table", filters],
    enabled: shouldLoadDirectory,
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const url = queryString ? `/api/admin/users/table?${queryString}` : "/api/admin/users/table";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const selectedIdsStable = useMemo(() => [...selectedUserIds].sort(), [selectedUserIds]);

  const {
    data: audiencePreview,
    isLoading: previewLoading,
    error: audiencePreviewError,
    refetch: refetchAudiencePreview,
  } = useQuery<MarketingAudiencePreview>({
    queryKey: ["/api/admin/users/marketing-email/preview", emailAudience, filters, selectedIdsStable],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users/marketing-email/preview", {
        ...filters,
        audience: emailAudience,
        selectedUserIds: selectedIdsStable,
      });
      return res.json();
    },
  });

  const sendPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users/marketing-email/test", {
        subject: emailSubject,
        body: emailBody,
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Preview email sent",
        description: `Sent to ${result.email}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Preview failed",
        description: error.message || "Could not send preview email.",
        variant: "destructive",
      });
    },
  });

  const sendMarketingEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users/marketing-email/send", {
        ...filters,
        audience: emailAudience,
        selectedUserIds: selectedIdsStable,
        subject: emailSubject,
        body: emailBody,
      });
      return res.json();
    },
    onSuccess: (result: MarketingSendResult) => {
      setLastSendResult(result);
      setConfirmSendOpen(false);
      toast({
        title: "Marketing email batch finished",
        description: `Sent ${result.totalSent} email${result.totalSent === 1 ? "" : "s"} with ${result.failedCount} failure${result.failedCount === 1 ? "" : "s"}.`,
      });
      void refetchAudiencePreview();
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk send failed",
        description: error.message || "Could not send the marketing email batch.",
        variant: "destructive",
      });
    },
  });

  const rows = data?.rows || [];
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedUserIds.includes(row.id));
  const selectedCount = selectedUserIds.length;
  const canSend = emailSubject.trim().length >= 3 && emailBody.trim().length >= 10;

  const toggleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) =>
      checked ? Array.from(new Set([...current, userId])) : current.filter((id) => id !== userId),
    );
  };

  const toggleSelectVisible = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds((current) => Array.from(new Set([...current, ...rows.map((row) => row.id)])));
      return;
    }
    const visibleIds = new Set(rows.map((row) => row.id));
    setSelectedUserIds((current) => current.filter((id) => !visibleIds.has(id)));
  };

  const openUser = (userId: string) => {
    setSelectedUserId(userId);
    setUserModalOpen(true);
  };

  const resetFilters = () => {
    setSearch("");
    setJoinedPreset("all");
    setJoinedFrom("");
    setJoinedTo("");
    setAccountStatus("all");
    setMarketingStatus("all");
    setSubscriptionTier("all");
    setCfiProfile("all");
    setAircraftOwner("all");
    setSortBy("createdAt");
    setSortDirection("desc");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Search by name, email, or `id:` lookup, then filter the matched users by join date, subscription access, and ownership footprint. Click any row to open the existing user detail view.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailAudience("selected_users")}
                disabled={selectedCount === 0}
              >
                Email selected users{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </Button>
              <Button type="button" onClick={() => setEmailAudience("all_active")}>
                Email all active users
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="admin-user-search">Search name, email, or user ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-user-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, or id:uuid"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date joined</Label>
              <Select value={joinedPreset} onValueChange={setJoinedPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last7">Last 7 days</SelectItem>
                  <SelectItem value="last30">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account status</Label>
              <Select value={accountStatus} onValueChange={setAccountStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {joinedPreset === "custom" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="joined-from">Joined from</Label>
                <Input
                  id="joined-from"
                  type="date"
                  value={joinedFrom}
                  onChange={(event) => setJoinedFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joined-to">Joined to</Label>
                <Input
                  id="joined-to"
                  type="date"
                  value={joinedTo}
                  onChange={(event) => setJoinedTo(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-2">
              <Label>Marketing status</Label>
              <Select value={marketingStatus} onValueChange={setMarketingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="subscribed">Subscribed</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subscription tier</Label>
              <Select value={subscriptionTier} onValueChange={setSubscriptionTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CFI profile</Label>
              <Select value={cfiProfile} onValueChange={setCfiProfile}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="with">Has CFI profile</SelectItem>
                  <SelectItem value="without">No CFI profile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aircraft owner</Label>
              <Select value={aircraftOwner} onValueChange={setAircraftOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="with">Has aircraft</SelectItem>
                  <SelectItem value="without">No aircraft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort by</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Date joined</SelectItem>
                  <SelectItem value="lastName">Last name</SelectItem>
                  <SelectItem value="firstName">First name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="membershipTier">Subscription tier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={sortDirection} onValueChange={setSortDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {!trimmedSearch
                ? "Enter a name, full email, or `id:` lookup to find users"
                : !shouldLoadDirectory
                  ? "Enter at least 2 characters for name search, or search by full email / `id:`."
                  : isLoading
                    ? "Loading users..."
                    : `Showing ${rows.length} matching user${rows.length === 1 ? "" : "s"}`}
              {shouldLoadDirectory && isFetching && !isLoading ? " • refreshing" : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedUserIds([])}
                disabled={selectedCount === 0}
              >
                Clear selection
              </Button>
            </div>
          </div>

          {shouldLoadDirectory && usersTableError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Could not load users. {usersTableError instanceof Error ? usersTableError.message : "Please try again."}
            </div>
          ) : null}

          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="w-12 px-3 py-3">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) => toggleSelectVisible(Boolean(checked))}
                      />
                    </th>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">Joined</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Tier</th>
                    <th className="px-3 py-3 font-medium">CFI</th>
                    <th className="px-3 py-3 font-medium">Aircraft</th>
                    <th className="px-3 py-3 font-medium">Marketplace</th>
                    <th className="px-3 py-3 font-medium">Marketing</th>
                  </tr>
                </thead>
                <tbody>
                  {!trimmedSearch ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        Enter a name, full email, or `id:` lookup to find users.
                      </td>
                    </tr>
                  ) : null}
                  {trimmedSearch && !shouldLoadDirectory ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        Enter at least 2 characters for name search, or search by full email / `id:`.
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selectedUserIds.includes(row.id)}
                          onCheckedChange={(checked) => toggleUserSelection(row.id, Boolean(checked))}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" className="text-left" onClick={() => openUser(row.id)}>
                          <div className="font-medium">
                            {[row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed user"}
                          </div>
                          <div className="text-xs text-muted-foreground">{row.id}</div>
                        </button>
                      </td>
                      <td className="px-3 py-3">{row.email || "—"}</td>
                      <td className="px-3 py-3">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={row.isSuspended ? "destructive" : "secondary"}>
                            {row.isSuspended ? "Inactive" : "Active"}
                          </Badge>
                          {row.emailVerified ? <Badge variant="outline">Verified</Badge> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline">{formatTier(row.effectiveMembershipTier)}</Badge>
                      </td>
                      <td className="px-3 py-3">{row.hasCfiProfile ? "Yes" : "No"}</td>
                      <td className="px-3 py-3">{row.aircraftCount}</td>
                      <td className="px-3 py-3">{row.marketplaceCount}</td>
                      <td className="px-3 py-3">
                        <Badge variant={row.marketingSubscribed ? "secondary" : "outline"}>
                          {row.marketingSubscribed ? "Subscribed" : "Unsubscribed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {trimmedSearch && shouldLoadDirectory && !isLoading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        No users found matching "{trimmedSearch}".
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Marketing Email</CardTitle>
              <CardDescription>
                Compose once, preview the audience, and send only after explicit confirmation.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => sendPreviewMutation.mutate()}
                disabled={!canSend || sendPreviewMutation.isPending || !adminUser?.email}
              >
                {sendPreviewMutation.isPending ? "Sending preview..." : "Send preview to me"}
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmSendOpen(true)}
                disabled={!canSend || previewLoading || (audiencePreview?.eligibleCount || 0) === 0}
              >
                Send marketing email
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select
                  value={emailAudience}
                  onValueChange={(value) =>
                    setEmailAudience(value as (typeof EMAIL_AUDIENCE_OPTIONS)[number]["value"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_AUDIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Recipient count
                </div>
                {previewLoading ? (
                  <div className="mt-3 text-sm text-muted-foreground">Loading audience...</div>
                ) : audiencePreviewError ? (
                  <div className="mt-3 text-sm text-destructive">
                    Could not load audience preview.{" "}
                    {audiencePreviewError instanceof Error ? audiencePreviewError.message : ""}
                  </div>
                ) : audiencePreview ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Matched</span>
                      <span>{audiencePreview.totalMatched}</span>
                    </div>
                    <div className="flex items-center justify-between font-medium">
                      <span>Eligible</span>
                      <span>{audiencePreview.eligibleCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Missing email</span>
                      <span>{audiencePreview.skippedMissingEmail}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Invalid email</span>
                      <span>{audiencePreview.skippedInvalidEmail}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Opted out</span>
                      <span>{audiencePreview.skippedOptedOut}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Duplicates</span>
                      <span>{audiencePreview.skippedDuplicates}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">Audience preview unavailable.</div>
                )}
              </div>

              {audiencePreview?.sampleRecipients?.length ? (
                <div className="rounded-md border bg-background">
                  <div className="border-b px-4 py-3 text-sm font-medium">Sample recipients</div>
                  <div className="max-h-64 overflow-y-auto">
                    {audiencePreview.sampleRecipients.map((recipient) => (
                      <div key={recipient.id} className="border-b px-4 py-3 text-sm last:border-b-0">
                        <div className="font-medium">
                          {[recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || recipient.email}
                        </div>
                        <div className="text-muted-foreground">{recipient.email}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="marketing-email-subject">Subject</Label>
                <Input
                  id="marketing-email-subject"
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  placeholder="A note from Ready Set Fly"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketing-email-body">Body</Label>
                <Textarea
                  id="marketing-email-body"
                  value={emailBody}
                  onChange={(event) => setEmailBody(event.target.value)}
                  rows={14}
                  placeholder={"Hi there,\n\nHere is what is new in Ready Set Fly...\n\nThanks,\nCory"}
                />
                <div className="text-xs text-muted-foreground">
                  This sends from the existing RSF email configuration. It skips invalid, duplicate, or opted-out recipients automatically.
                </div>
              </div>

              {lastSendResult ? (
                <div className="rounded-md border bg-muted/20 p-4 text-sm">
                  <div className="font-medium">Last send result</div>
                  <div className="mt-2 flex flex-wrap gap-4 text-muted-foreground">
                    <span>Sent: {lastSendResult.totalSent}</span>
                    <span>Skipped: {lastSendResult.totalSkipped}</span>
                    <span>Failed: {lastSendResult.failedCount}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
          <div className="flex max-h-[90vh] flex-col">
            <AlertDialogHeader className="border-b px-6 py-4 text-left">
              <AlertDialogTitle>Send marketing email?</AlertDialogTitle>
              <AlertDialogDescription>
                This will send the current message to {audiencePreview?.eligibleCount || 0} eligible recipient
                {(audiencePreview?.eligibleCount || 0) === 1 ? "" : "s"}. Missing, invalid, duplicate, and opted-out emails are skipped automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="min-h-0 overflow-y-auto px-6 py-4">
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="font-medium">{emailSubject.trim() || "No subject"}</div>
                <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {emailBody.trim() || "No body"}
                </div>
              </div>
            </div>
            <AlertDialogFooter className="border-t px-6 py-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  sendMarketingEmailMutation.mutate();
                }}
                disabled={sendMarketingEmailMutation.isPending}
              >
                {sendMarketingEmailMutation.isPending ? "Sending..." : "Confirm send"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AdminUserModal userId={selectedUserId} open={userModalOpen} onOpenChange={setUserModalOpen} />
    </>
  );
}
