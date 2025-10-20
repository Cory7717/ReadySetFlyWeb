import { Link, useLocation } from "wouter";
import { Plane, User, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [location] = useLocation();
  
  const isRentals = location === "/" || location.startsWith("/aircraft");
  const isMarketplace = location.startsWith("/marketplace");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-md px-2 py-1" data-testid="link-home">
            <Plane className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">Ready Set Fly</span>
          </Link>

          {/* Main Navigation Tabs */}
          <nav className="flex items-center gap-1 rounded-full bg-muted p-1" role="navigation" aria-label="Main navigation">
            <Link href="/" data-testid="link-rentals">
              <Button
                variant="ghost"
                className={`rounded-full ${isRentals ? "bg-background shadow-sm" : ""}`}
              >
                Rentals
              </Button>
            </Link>
            <Link href="/marketplace" data-testid="link-marketplace">
              <Button
                variant="ghost"
                className={`rounded-full ${isMarketplace ? "bg-background shadow-sm" : ""}`}
              >
                Marketplace
              </Button>
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <Link href="/list-aircraft" data-testid="link-list-aircraft">
              <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent" data-testid="button-list-aircraft">
                List Your Aircraft
              </Button>
            </Link>

            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                3
              </Badge>
            </Button>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-profile-menu" aria-label="User menu">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" data-testid="link-dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" data-testid="link-profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-listings" data-testid="link-my-listings">My Listings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages" data-testid="link-messages">Messages</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="button-logout">
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
