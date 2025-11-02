import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ready Set Fly. All rights reserved.
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link 
              href="/privacy-policy" 
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
              data-testid="link-privacy-policy"
            >
              Privacy Policy
            </Link>
            <Separator orientation="vertical" className="h-4 hidden md:block" />
            <Link 
              href="/terms-of-service" 
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
              data-testid="link-terms-of-service"
            >
              Terms of Service
            </Link>
            <Separator orientation="vertical" className="h-4 hidden md:block" />
            <Link 
              href="/delete-account" 
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
              data-testid="link-delete-account"
            >
              Delete Account
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
