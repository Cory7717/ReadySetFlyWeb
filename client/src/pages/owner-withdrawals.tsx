import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: string;
  paypalEmail: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  payoutBatchId?: string;
  payoutItemId?: string;
  transactionId?: string;
  failureReason?: string;
  adminNotes?: string;
}

export default function OwnerWithdrawals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paypalEmail, setPaypalEmail] = useState(user?.paypalEmail || "");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  // Fetch user balance
  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: string }>({
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
        title: "PayPal Email Updated",
        description: "Your PayPal email has been saved successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update PayPal email",
        variant: "destructive"
      });
    }
  });

  // Request withdrawal mutation
  const requestWithdrawalMutation = useMutation({
    mutationFn: async (data: { amount: string; paypalEmail: string }) => {
      const response = await apiRequest("POST", "/api/withdrawals", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      setWithdrawalAmount("");
      toast({
        title: "Payout Processing",
        description: "Your funds are being sent to PayPal now. Funds typically arrive within minutes."
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
        description: "Please enter a valid PayPal email address",
        variant: "destructive"
      });
      return;
    }
    updateEmailMutation.mutate(paypalEmail);
  };

  const handleRequestWithdrawal = () => {
    const amount = parseFloat(withdrawalAmount);
    const currentBalance = parseFloat(balanceData?.balance || "0");

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive"
      });
      return;
    }

    if (amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "Withdrawal amount exceeds your available balance",
        variant: "destructive"
      });
      return;
    }

    if (!paypalEmail) {
      toast({
        title: "PayPal Email Required",
        description: "Please set your PayPal email before requesting a withdrawal",
        variant: "destructive"
      });
      return;
    }

    requestWithdrawalMutation.mutate({ amount: withdrawalAmount, paypalEmail });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-pending`}><Clock className="w-3 h-3" />Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-processing`}><AlertCircle className="w-3 h-3" />Processing</Badge>;
      case "completed":
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-completed`}><CheckCircle className="w-3 h-3" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1" data-testid={`badge-status-failed`}><XCircle className="w-3 h-3" />Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-cancelled`}><XCircle className="w-3 h-3" />Cancelled</Badge>;
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

  const currentBalance = parseFloat(balanceData?.balance || "0");

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-withdrawals">Withdrawals & Payouts</h1>
        <p className="text-muted-foreground">Manage your rental earnings and request withdrawals</p>
      </div>

      {/* Current Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="heading-balance">
            <DollarSign className="w-5 h-5" />
            Available Balance
          </CardTitle>
          <CardDescription>Your current balance available for withdrawal</CardDescription>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <p className="text-muted-foreground">Loading balance...</p>
          ) : (
            <div className="text-4xl font-bold" data-testid="text-balance">${currentBalance.toFixed(2)}</div>
          )}
        </CardContent>
      </Card>

      {/* PayPal Email Setup */}
      <Card>
        <CardHeader>
          <CardTitle data-testid="heading-paypal-setup">PayPal Email</CardTitle>
          <CardDescription>Set your PayPal email to receive withdrawals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paypal-email">PayPal Email Address</Label>
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
            Payouts are sent via PayPal and typically arrive within minutes to 30 minutes.
          </p>
        </CardContent>
      </Card>

      {/* Request Withdrawal */}
      <Card>
        <CardHeader>
          <CardTitle data-testid="heading-request-withdrawal">Request Withdrawal</CardTitle>
          <CardDescription>Withdraw your available balance to PayPal</CardDescription>
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
                  max={currentBalance}
                  placeholder="0.00"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-withdrawal-amount"
                />
              </div>
              <Button
                onClick={handleRequestWithdrawal}
                disabled={requestWithdrawalMutation.isPending || currentBalance <= 0}
                data-testid="button-request-withdrawal"
              >
                {requestWithdrawalMutation.isPending ? "Requesting..." : "Request Withdrawal"}
              </Button>
            </div>
          </div>
          <div className="bg-muted p-4 rounded-md space-y-2">
            <p className="text-sm font-medium">Important Information</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Withdrawals are processed instantly via PayPal Payouts</li>
              <li>• PayPal charges approximately 2% per payout (deducted from platform funds)</li>
              <li>• Funds typically arrive in your PayPal account within minutes</li>
              <li>• You'll receive an email confirmation from PayPal when funds arrive</li>
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
                      Requested: {new Date(withdrawal.requestedAt).toLocaleDateString()}
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
