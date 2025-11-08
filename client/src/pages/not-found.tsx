import { Link } from "wouter";
import { Plane, Home, Search, Bookmark, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-12">
      <div className="flex flex-col gap-8 items-center text-center max-w-3xl">
        {/* Error Icon & Message */}
        <div className="flex flex-col items-center gap-4">
          <Plane className="h-32 w-32 text-muted-foreground/20 animate-pulse" />
          <div>
            <h1 className="font-display text-7xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              404
            </h1>
            <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground max-w-md">
              Looks like this flight path doesn't exist. The page you're looking for may have been moved or deleted.
            </p>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid md:grid-cols-3 gap-4 w-full mt-4">
          <Link href="/">
            <Card className="hover-elevate cursor-pointer" data-testid="card-nav-home">
              <CardContent className="flex flex-col items-center gap-3 p-6">
                <Home className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">Home</h3>
                  <p className="text-sm text-muted-foreground">Return to landing page</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/rentals">
            <Card className="hover-elevate cursor-pointer" data-testid="card-nav-rentals">
              <CardContent className="flex flex-col items-center gap-3 p-6">
                <Search className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">Browse Rentals</h3>
                  <p className="text-sm text-muted-foreground">Find aircraft to rent</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/marketplace">
            <Card className="hover-elevate cursor-pointer" data-testid="card-nav-marketplace">
              <CardContent className="flex flex-col items-center gap-3 p-6">
                <Plane className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">Marketplace</h3>
                  <p className="text-sm text-muted-foreground">Aviation services</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Authenticated User Links */}
        {isAuthenticated && (
          <div className="grid md:grid-cols-3 gap-4 w-full">
            <Link href="/dashboard">
              <Card className="hover-elevate cursor-pointer" data-testid="card-nav-dashboard">
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <User className="h-8 w-8 text-accent" />
                  <div>
                    <h3 className="font-semibold mb-1">Dashboard</h3>
                    <p className="text-sm text-muted-foreground">View your activity</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/favorites">
              <Card className="hover-elevate cursor-pointer" data-testid="card-nav-favorites">
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <Bookmark className="h-8 w-8 text-accent" />
                  <div>
                    <h3 className="font-semibold mb-1">Favorites</h3>
                    <p className="text-sm text-muted-foreground">Saved listings</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/messages">
              <Card className="hover-elevate cursor-pointer" data-testid="card-nav-messages">
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <MessageSquare className="h-8 w-8 text-accent" />
                  <div>
                    <h3 className="font-semibold mb-1">Messages</h3>
                    <p className="text-sm text-muted-foreground">Check conversations</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Primary CTA */}
        <div className="flex gap-3 mt-4">
          <Link href="/">
            <Button size="lg" data-testid="button-go-home">
              <Home className="h-5 w-5 mr-2" />
              Return to Home
            </Button>
          </Link>
          {!isAuthenticated && (
            <Link href="/login">
              <Button size="lg" variant="outline" data-testid="button-sign-in">
                Sign In
              </Button>
            </Link>
          )}
        </div>

        {/* Help Text */}
        <p className="text-sm text-muted-foreground mt-4">
          If you believe this is an error, please{" "}
          <Link href="/messages" className="text-primary hover:underline">
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
