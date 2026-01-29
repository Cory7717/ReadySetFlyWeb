import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function AdminInviteAccept() {
  const [location, setLocation] = useLocation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing invite token.");
      return;
    }
    setStatus("loading");
    apiRequest("POST", "/api/admin/invites/accept", { token })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to accept invite");
        }
        setStatus("success");
        setMessage("Admin invite accepted. Your access is now active.");
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.message || "Failed to accept invite.");
      });
  }, []);

  return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Admin Invite</CardTitle>
          <CardDescription>Confirm your Ready Set Fly admin access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && <div className="text-sm text-muted-foreground">Accepting invite...</div>}
          {status !== "loading" && <div className="text-sm">{message}</div>}
          <Button onClick={() => setLocation("/admin")}>Go to Admin Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
