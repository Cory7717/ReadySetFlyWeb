import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StudentLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function StudentLayout({ title, subtitle, children }: StudentLayoutProps) {
  return (
    <div className="min-h-screen">
      <section className="bg-muted py-8 sm:py-10">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-2 max-w-3xl">{subtitle}</p>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
