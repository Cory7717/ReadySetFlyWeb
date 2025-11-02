import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from "@shared/schema";
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
import { Trash2, User as UserIcon, FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function Settings() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/auth/user");
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });
      // Redirect to home page after deletion
      window.location.href = "/";
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
      <div className="container max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Please log in to access settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              <CardTitle>Account Information</CardTitle>
            </div>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-base" data-testid="text-user-email">{user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-base" data-testid="text-user-name">
                {user.firstName} {user.lastName}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Status</label>
              <p className="text-base" data-testid="text-verification-status">
                {user.isVerified ? "Verified" : "Not Verified"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Legal Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Legal Documents</CardTitle>
            </div>
            <CardDescription>View our legal policies and terms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/privacy-policy">
              <Button variant="outline" className="w-full justify-start" data-testid="link-privacy-policy">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Privacy Policy
              </Button>
            </Link>
            <Link href="/terms-of-service">
              <Button variant="outline" className="w-full justify-start" data-testid="link-terms-of-service">
                <FileText className="mr-2 h-4 w-4" />
                Terms of Service
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Danger Zone - Account Deletion */}
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm text-destructive font-medium mb-2">
                Warning: This action cannot be undone
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

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
