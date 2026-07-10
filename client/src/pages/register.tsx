import { useEffect, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiUrl } from "@/lib/api";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, ChevronRight, Plane } from 'lucide-react';
import { trackEvent } from "@/lib/analytics";
import { pixelEvent } from "@/lib/pixel";
import { getReturnToFromWindow, withReturnTo } from "@/lib/returnTo";

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  promoCode: z.string().max(120).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const redirectTarget = getReturnToFromWindow();
  const initialPromoCode = new URLSearchParams(window.location.search).get("code") || "";

  useEffect(() => {
    trackEvent("signup_page_viewed", {
      page: "/register",
      source_page: redirectTarget,
      redirect_target: redirectTarget,
    });
  }, [redirectTarget]);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      promoCode: initialPromoCode,
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterForm, 'confirmPassword'>) => {
      const response = await fetch(apiUrl('/api/auth/web-register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, turnstileToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create account');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate user query to refetch with new session
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      trackEvent("sign_up", {
        method: "email",
        source_page: redirectTarget,
        redirect_target: redirectTarget,
      });
      pixelEvent("CompleteRegistration", {
        content_name: "RSF Free Account",
        status: true,
      });
      toast({
        title: 'Account created!',
        description: data.promotionRedemption?.ok
          ? data.promotionRedemption.message
          : data.promotionRedemption?.message || data.message || 'Please check your email to verify your account.',
      });
      setLocation(redirectTarget);
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      trackEvent("signup_started", {
        method: "email",
        page: "/register",
        source_page: redirectTarget,
        redirect_target: redirectTarget,
      });
      const { confirmPassword, ...registerData } = data;
      await registerMutation.mutateAsync(registerData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_32%),linear-gradient(135deg,#f6fbff,#eef4ff_52%,#f8fafc)] p-4">
      <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-6 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-sky-100 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,64,175,0.92))] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/16">
            <Plane className="h-7 w-7" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-100/80">Ready Set Fly</div>
            <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
              Create a free account when you want RSF to keep working for you.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-sky-50 sm:text-base">
              Save your first plan, keep tools synced across devices, track logbook activity, and upgrade only when the extra workflow value is clear.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Save flight plans and return to them later.",
              "Keep logbook entries, training, and favorites in one place.",
              "Use marketplace and pilot tools without starting over each visit.",
              "Start free. No credit card needed for the account itself.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 text-sm text-sky-50"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                  <span>{item}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-white/12 bg-white/8 p-4">
            <div className="text-sm font-semibold">Best path for most users</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-sky-50">
              <span>Continue with Google</span>
              <ChevronRight className="h-4 w-4" />
              <span>Get back to what you were doing</span>
            </div>
            <div className="mt-2 text-xs text-sky-50/90">
              Faster signup usually wins. Email signup is still available below.
            </div>
          </div>
        </div>

        <Card className="w-full border-white/70 bg-white/92 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold">Create your free account</CardTitle>
            <CardDescription>
              Save your work, keep your place, and come back to the same tools later.
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              Free account first. Upgrade only if RSF Pro becomes worth it for your workflow.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => {
                trackEvent("signup_started", {
                  method: "google",
                  page: "/register",
                  source_page: redirectTarget,
                  redirect_target: redirectTarget,
                });
                window.location.href = apiUrl(withReturnTo('/api/auth/google', redirectTarget));
              }}
              data-testid="button-oauth-register"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  Or sign up with email
                </span>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    {...form.register('firstName')}
                    data-testid="input-firstname"
                    disabled={isLoading}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    {...form.register('lastName')}
                    data-testid="input-lastname"
                    disabled={isLoading}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="pilot@example.com"
                  {...form.register('email')}
                  data-testid="input-email"
                  disabled={isLoading}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="promoCode">Promo or invitation code</Label>
                <Input
                  id="promoCode"
                  placeholder="Optional"
                  {...form.register('promoCode')}
                  data-testid="input-promo-code"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Have a partner, event, or giveaway code? Enter it here.
                </p>
                {form.formState.errors.promoCode && (
                  <p className="text-sm text-destructive">{form.formState.errors.promoCode.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  {...form.register('password')}
                  data-testid="input-password"
                  disabled={isLoading}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  {...form.register('confirmPassword')}
                  data-testid="input-confirm-password"
                  disabled={isLoading}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                onSuccess={(token) => setTurnstileToken(token)}
                options={{ theme: 'light' }}
              />

              <Button
                type="submit"
                className="h-11 w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? 'Creating account...' : 'Create Free Account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center text-xs text-muted-foreground">
              Service available for US residents only
            </div>
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={() => setLocation(withReturnTo('/login', redirectTarget))}
                className="text-primary hover:underline font-medium"
                data-testid="link-login"
              >
                Sign in
              </button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
