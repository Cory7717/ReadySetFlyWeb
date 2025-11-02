import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Trash2, AlertTriangle } from "lucide-react";
import type { User } from "@shared/schema";
import { Link } from "wouter";

export default function DeleteAccount() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleted, setIsDeleted] = useState(false);

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/auth/user");
      return response;
    },
    onSuccess: () => {
      setIsDeleted(true);
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: 'Please type "DELETE" to confirm.',
        variant: "destructive",
      });
      return;
    }
    deleteAccountMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto p-6 min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success message after deletion
  if (isDeleted) {
    return (
      <div className="container max-w-2xl mx-auto p-6 min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Account Deleted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Your account and all associated data have been permanently deleted.
            </p>
            <p className="text-center text-muted-foreground">
              Thank you for using Ready Set Fly. We hope to see you again in the future.
            </p>
            <div className="flex justify-center pt-4">
              <Link href="/">
                <Button data-testid="button-back-home">
                  Return to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show login prompt for unauthenticated users
  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto p-6 min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Delete Your Account</CardTitle>
            <CardDescription className="text-center">
              Sign in to delete your Ready Set Fly account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              You must be signed in to delete your account.
            </p>
            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login-to-delete"
              >
                Sign In to Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show account deletion form for authenticated users
  return (
    <div className="container max-w-2xl mx-auto p-6 min-h-[60vh] flex items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2 justify-center">
            <Trash2 className="h-6 w-6 text-destructive" />
            <CardTitle>Delete Your Account</CardTitle>
          </div>
          <CardDescription className="text-center">
            Permanently remove your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Account Information</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Email:</span> {user.email}</p>
              <p><span className="font-medium text-foreground">Name:</span> {user.firstName} {user.lastName}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  This action cannot be undone
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>All your aircraft listings will be permanently deleted</li>
                  <li>All your marketplace listings will be removed</li>
                  <li>Your rental history will be deleted</li>
                  <li>All messages and conversations will be deleted</li>
                  <li>Your verification documents will be permanently removed</li>
                  <li>All financial records and transactions will be deleted</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Delete Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                data-testid="button-delete-account"
                onClick={() => setConfirmText("")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <p>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers.
                  </p>
                  <div className="space-y-2">
                    <label htmlFor="confirm-delete" className="text-sm font-medium">
                      Type <span className="font-bold">DELETE</span> to confirm:
                    </label>
                    <Input
                      id="confirm-delete"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type DELETE here"
                      data-testid="input-confirm-delete"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleteAccountMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Links */}
          <div className="text-center space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Need help or have questions?
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <Link href="/privacy-policy" className="text-primary hover:underline" data-testid="link-privacy">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="text-primary hover:underline" data-testid="link-terms">
                Terms of Service
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
