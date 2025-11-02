import { Link } from "wouter";
import { LogIn, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RequireAuth() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Plane className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Sign In Required</CardTitle>
            <CardDescription className="text-base mt-2">
              You need to be signed in to create listings and access this feature
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Create an account or sign in to list your aircraft, post marketplace listings, and connect with the aviation community.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/login">
              <Button 
                size="lg" 
                className="w-full"
                data-testid="button-sign-in-required"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign In to Continue
              </Button>
            </Link>
            <Link href="/">
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full"
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
