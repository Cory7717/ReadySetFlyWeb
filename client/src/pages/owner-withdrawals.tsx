import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: string;
  paypalEmail: string;
  status: "processing" | "completed" | "failed";
  requestedAt: Date;
  processedAt?: Date;
  payoutBatchId?: string;
  payoutItemId?: string;
  transactionId?: string;
  failureReason?: string;
}

interface BalanceData {
  balance: string;
  heldBalance: string;
  nextAvailableAt: string | null;
}

export default function OwnerWithdrawals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paypalEmail, setPaypalEmail] = useState(user?.paypalEmail || "");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  // Fetch user balance (triggers hold release server-side)
  const { data: balanceData, isLoading: balanceLoading } = useQuery<BalanceData>({
    queryKey: ["/api/balance"],
    enabled: !!user
  });

  // Fetch withdrawal history
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/withdrawals"],
    enabled: !!user
  });

  // Update PayPal email mutation
  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("PATCH", "/api/user/profile", { paypalEmail: email });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "PayPal Business/Commerce Email Updated",
        description: "Your PayPal Business/Commerce email has been saved successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update PayPal Business/Commerce email",
        variant: "destructive"
      });
    }
  });

  // Request withdrawal mutation
  const requestWithdrawalMutation = useMutation({
    mutationFn: async (data: { amount: string; paypalEmail: string }) => {
      const response = await apiRequest("POST", "/api/withdrawals", data);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Failed to request withdrawal");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      setWithdrawalAmount("");
      toast({
        title: "Payout Processing",
        description: "Your funds are being sent to PayPal Business/Commerce now. Funds typically arrive within minutes."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to request withdrawal",
        variant: "destructive"
      });
    }
  });

  const handleUpdateEmail = () => {
    if (!paypalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid PayPal Business/Commerce email address",
        variant: "destructive"
      });
      return;
    }
    updateEmailMutation.mutate(paypalEmail);
  };

  const handleRequestWithdrawal = () => {
    const amount = parseFloat(withdrawalAmount);
    const availableBalance = parseFloat(balanceData?.balance || "0");

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive"
      });
      return;
    }

    if (amount > availableBalance) {
      const heldAmount = parseFloat(balanceData?.heldBalance || "0");
      toast({
        title: "Insufficient Available Balance",
        description: heldAmount > 0
          ? `$${heldAmount.toFixed(2)} is still in the hold period. Try again once it's released.`
          : "Withdrawal amount exceeds your available balance",
        variant: "destructive"
      });
      return;
    }

    if (!paypalEmail) {
      toast({
        title: "PayPal Business/Commerce Email Required",
        description: "Please set your PayPal Business/Commerce email before requesting a withdrawal",
        variant: "destructive"
      });
      return;
    }

    requestWithdrawalMutation.mutate({ amount: withdrawalAmount, paypalEmail });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processing":
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-processing`}><AlertCircle className="w-3 h-3" />Processing</Badge>;
      case "completed":
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-completed`}><CheckCircle className="w-3 h-3" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1" data-testid={`badge-status-failed`}><XCircle className="w-3 h-3" />Failed</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to view your withdrawals.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const availableBalance = parseFloat(balanceData?.balance || "0");
  const heldBalance = parseFloat(balanceData?.heldBalance || "0");
  const nextAvailableAt = balanceData?.nextAvailableAt ? new Date(balanceData.nextAvailableAt) : null;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-withdrawals">Withdrawals & Payouts</h1>
        <p className="text-muted-foreground">Manage your rental earnings and request withdrawals</p>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Available Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="heading-balance">
              <DollarSign className="w-5 h-5" />
              Available Balance
            </CardTitle>
            <CardDescription>Ready to withdraw to PayPal</CardDescription>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-4xl font-bold" data-testid="text-balance">
                ${availableBalance.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Hold Balance */}
        <Card className={heldBalance > 0 ? "border-amber-500/40" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600" data-testid="heading-held-balance">
              <Lock className="w-5 h-5" />
              Pending Release
            </CardTitle>
            <CardDescription>Rental earnings still in hold period</CardDescription>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div>
                <div className="text-4xl font-bold text-amber-600" data-testid="text-held-balance">
                  ${heldBalance.toFixed(2)}
                </div>
                {nextAvailableAt && (
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1" data-testid="text-next-available">
                    <Clock className="w-3 h-3" />
                    Next release: {nextAvailableAt.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hold period notice */}
      {heldBalance > 0 && (
        <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <span className="font-medium">${heldBalance.toFixed(2)}</span> in rental earnings is in the payout hold period.
            {nextAvailableAt && (
              <> It will be available for withdrawal on <span className="font-medium">{nextAvailableAt.toLocaleString()}</span>.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* PayPal Email Setup */}
      <Card>
        <CardHeader>
          <CardTitle data-testid="heading-paypal-setup">PayPal Business/Commerce Email</CardTitle>
          <CardDescription>Set your PayPal Business/Commerce email to receive withdrawals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paypal-email">PayPal Business/Commerce Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="paypal-email"
                type="email"
                placeholder="your.email@example.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                data-testid="input-paypal-email"
              />
              <Button
                onClick={handleUpdateEmail}
                disabled={updateEmailMutation.isPending}
                data-testid="button-save-email"
              >
                {updateEmailMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Payouts are sent via PayPal Business/Commerce, a trusted global payments platform, and typically arrive within minutes to 30 minutes.
          </p>
        </CardContent>
      </Card>

      {/* Request Withdrawal */}
      <Card>
        <CardHeader>
          <CardTitle data-testid="heading-request-withdrawal">Request Withdrawal</CardTitle>
          <CardDescription>Withdraw your available balance to PayPal Business/Commerce</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdrawal-amount">Withdrawal Amount</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={availableBalance}
                  placeholder="0.00"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-withdrawal-amount"
                />
              </div>
              <Button
                onClick={handleRequestWithdrawal}
                disabled={requestWithdrawalMutation.isPending || availableBalance <= 0}
                data-testid="button-request-withdrawal"
              >
                {requestWithdrawalMutation.isPending ? "Requesting..." : "Request Withdrawal"}
              </Button>
            </div>
          </div>
          <div className="bg-muted p-4 rounded-md space-y-2">
            <p className="text-sm font-medium">Important Information</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Rental earnings become available for withdrawal after a short hold period</li>
              <li>• Withdrawals are processed instantly via PayPal Business/Commerce Payouts</li>
              <li>• PayPal Business/Commerce charges approximately 2% per payout (deducted from platform funds)</li>
              <li>• Funds typically arrive in your PayPal Business/Commerce account within minutes</li>
              <li>• You'll receive an email confirmation from PayPal Business/Commerce when funds arrive</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle data-testid="heading-withdrawal-history">Withdrawal History</CardTitle>
          <CardDescription>View your past withdrawal requests</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawalsLoading ? (
            <p className="text-muted-foreground">Loading withdrawal history...</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-withdrawals">
              No withdrawal requests yet
            </p>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-4 border rounded-md"
                  data-testid={`card-withdrawal-${withdrawal.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium" data-testid={`text-amount-${withdrawal.id}`}>
                        ${parseFloat(withdrawal.amount).toFixed(2)}
                      </p>
                      {getStatusBadge(withdrawal.status)}
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-email-${withdrawal.id}`}>
                      To: {withdrawal.paypalEmail}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-date-${withdrawal.id}`}>
                      Requested: {withdrawal.requestedAt ? new Date(withdrawal.requestedAt).toLocaleDateString() : 'N/A'}
                    </p>
                    {withdrawal.processedAt && (
                      <p className="text-sm text-muted-foreground" data-testid={`text-processed-${withdrawal.id}`}>
                        Processed: {new Date(withdrawal.processedAt).toLocaleDateString()}
                      </p>
                    )}
                    {withdrawal.failureReason && (
                      <p className="text-sm text-destructive" data-testid={`text-error-${withdrawal.id}`}>
                        Error: {withdrawal.failureReason}
                      </p>
                    )}
                  </div>
                  {withdrawal.transactionId && (
                    <div className="text-xs text-muted-foreground" data-testid={`text-transaction-${withdrawal.id}`}>
                      Transaction: {withdrawal.transactionId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
