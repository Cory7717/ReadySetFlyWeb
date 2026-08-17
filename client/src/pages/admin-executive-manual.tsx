import { BookOpen, ChevronLeft, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { ExecutiveManualReader } from "@/components/admin/executive-manual/ExecutiveManualReader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function AdminExecutiveManualPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" aria-label="Loading administrator access" /></div>;
  }

  if (!user?.isAdmin && !user?.isSuperAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Administrator access required</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>The RSF Executive Manual is an internal leadership resource available through the Admin Dashboard.</p>
            <Button asChild variant="outline"><Link href="/"><ChevronLeft className="mr-2 h-4 w-4" />Return to Ready Set Fly</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0f18] px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-300"><BookOpen className="h-4 w-4" /> Internal leadership resource</div>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">RSF Executive Manual</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A guided executive reference for the platform, business model, operating strategy and long-term vision.</p>
          </div>
          <Button asChild variant="outline" className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white">
            <Link href="/admin"><ChevronLeft className="mr-2 h-4 w-4" />Admin Dashboard</Link>
          </Button>
        </header>
        <ExecutiveManualReader />
      </div>
    </main>
  );
}
