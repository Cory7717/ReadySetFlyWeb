import { Link, useLocation } from "wouter";
import { User, Bell, LogOut } from "lucide-react";
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
import logoImage from "@assets/RSFOpaqueLogo_1761494760586.png";

export function Header() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isRentals = location === "/rentals" || location.startsWith("/aircraft");
  const isMarketplace = location.startsWith("/marketplace");
  
  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";
  
  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0].toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 sm:gap-2 hover-elevate active-elevate-2 rounded-md px-1 sm:px-2 py-1 flex-shrink-0" data-testid="link-home">
            <img src={logoImage} alt="Ready Set Fly" className="h-8 w-8 sm:h-[2.6rem] sm:w-[2.6rem]" />
            <span className="font-display text-sm sm:text-xl font-bold hidden min-[400px]:inline">Ready Set Fly</span>
          </Link>

          {/* Main Navigation Tabs - Compact on mobile */}
          <nav className="flex items-center gap-0.5 sm:gap-1 rounded-full bg-muted p-0.5 sm:p-1" role="navigation" aria-label="Main navigation">
            <Link href="/rentals" data-testid="link-rentals">
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full text-xs sm:text-sm px-2 sm:px-4 ${isRentals ? "bg-background shadow-sm" : ""}`}
              >
                Rentals
              </Button>
            </Link>
            <Link href="/marketplace" data-testid="link-marketplace">
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full text-xs sm:text-sm px-2 sm:px-4 ${isMarketplace ? "bg-background shadow-sm" : ""}`}
              >
                Marketplace
              </Button>
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {user && (
              <Link href="/list-aircraft" data-testid="link-list-aircraft" className="hidden sm:block">
                <Button variant="default" className="bg-accent text-accent-foreground hover:bg-accent" data-testid="button-list-aircraft">
                  List Your Aircraft
                </Button>
              </Link>
            )}

            {user && (
              <Button variant="ghost" size="icon" className="relative hidden sm:flex" data-testid="button-notifications" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  3
                </Badge>
              </Button>
            )}

            <ThemeToggle />

            {/* Show sign in button for anonymous users */}
            {!user ? (
              <Link href="/login">
                <Button 
                  variant="default" 
                  data-testid="button-login"
                >
                  Sign In
                </Button>
              </Link>
            ) : (
              <>
                {/* Super Admin Badge */}
                {user.isSuperAdmin && (
                  <Badge variant="default" className="bg-primary text-primary-foreground" data-testid="badge-super-admin">
                    Super Admin
                  </Badge>
                )}

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
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium leading-none">{displayName}</p>
                          {user?.isSuperAdmin && (
                            <Badge variant="default" className="text-xs h-5 bg-primary text-primary-foreground">
                              Super Admin
                            </Badge>
                          )}
                        </div>
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
                    <DropdownMenuItem asChild>
                      <Link href="/logbook" data-testid="link-logbook">Pilot Logbook</Link>
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
                    <DropdownMenuItem asChild>
                      <Link href="/settings" data-testid="link-settings">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/api/logout" data-testid="button-logout">
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
