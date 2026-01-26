import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LogbookProCancel() {
  return (
    <div className="container mx-auto py-10 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Cancelled</CardTitle>
          <CardDescription>You can continue using the free logbook anytime.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/logbook">Back to Logbook</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
