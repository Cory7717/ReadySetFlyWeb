import { Link } from "wouter";
import { Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col gap-6 items-center text-center max-w-md px-4">
        <Plane className="h-24 w-24 text-muted-foreground/30" />
        <div>
          <h1 className="font-display text-6xl font-bold mb-2">404</h1>
          <p className="text-xl text-muted-foreground">Page not found</p>
        </div>
        <p className="text-muted-foreground">
          Looks like this flight path doesn't exist. Let's get you back on course.
        </p>
        <Link href="/">
          <Button size="lg" data-testid="button-go-home">
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
