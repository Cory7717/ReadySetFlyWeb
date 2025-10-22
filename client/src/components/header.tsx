import { Link, useLocation } from "wouter";
import { Plane, User, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isRentals = location === "/" || location.startsWith("/aircraft");
  const isMarketplace = location.startsWith("/marketplace");
  
  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";
  
  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0].toUpperCase() || "U";

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
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-profile-menu" aria-label="User menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                {user?.isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" data-testid="link-admin" className="text-primary font-medium">
                        🛡️ Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.location.href = '/api/logout'} data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />
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
