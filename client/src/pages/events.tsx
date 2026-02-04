import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Link } from "wouter";
import { CalendarDays, MapPin, ExternalLink } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AviationEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  eventUrl?: string | null;
  startDate: string;
  endDate: string;
  isSample?: boolean;
};

const categoryOptions = [
  "Airshow",
  "Fly-In",
  "Safety Seminar",
  "Training",
  "Meetup",
  "Charity",
  "Career",
  "Museum",
  "Other",
] as const;

const eventSchema = z
  .object({
    title: z.string().min(3, "Title is required"),
    description: z.string().min(20, "Tell pilots what to expect"),
    location: z.string().min(3, "Location is required"),
    category: z.enum(categoryOptions, { required_error: "Select a category" }),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    eventUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
    aviationOnly: z.literal(true, {
      errorMap: () => ({ message: "Confirm this is an aviation-only event" }),
    }),
  })
  .refine(
    (data) => new Date(data.endDate).getTime() >= new Date(data.startDate).getTime(),
    { path: ["endDate"], message: "End date must be after the start date" }
  );

const formatDateRange = (start: string, end: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";
  if (startDate.toDateString() === endDate.toDateString()) {
    return formatter.format(startDate);
  }
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

export default function EventsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<AviationEvent | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    location: "",
    category: "" as (typeof categoryOptions)[number] | "",
    startDate: "",
    endDate: "",
    eventUrl: "",
    aviationOnly: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["aviation-events"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/events"));
      if (!response.ok) {
        throw new Error("Failed to load events");
      }
      return response.json();
    },
  });

  const events: AviationEvent[] = data?.events ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: typeof formState) => {
      const response = await fetch(apiUrl("/api/events"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          startDate: new Date(payload.startDate).toISOString(),
          endDate: new Date(payload.endDate).toISOString(),
          eventUrl: payload.eventUrl || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to publish event");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event posted",
        description: "Your aviation event is live. It will auto-expire after the end date.",
      });
      setFormState({
        title: "",
        description: "",
        location: "",
        category: "",
        startDate: "",
        endDate: "",
        eventUrl: "",
        aviationOnly: false,
      });
      setFormErrors({});
      queryClient.invalidateQueries({ queryKey: ["aviation-events"] });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to post event",
        description: error?.message || "Please review the event details and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = eventSchema.safeParse(formState);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const nextErrors: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([key, value]) => {
        if (value?.length) nextErrors[key] = value[0];
      });
      setFormErrors(nextErrors);
      const firstError = result.error.errors[0]?.message;
      toast({
        title: "Fix the form",
        description: firstError || "Please review the required fields.",
        variant: "destructive",
      });
      return;
    }
    setFormErrors({});
    mutation.mutate(result.data);
  };

  const hasEvents = events.length > 0;
  const eventSummary = useMemo(
    () => events.slice(0, 10),
    [events]
  );

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-slate-50 via-background to-background py-12">
        <div className="container mx-auto px-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Aviation Community Calendar
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Upcoming Aviation Events</h1>
          <p className="text-muted-foreground max-w-3xl">
            Share fly-ins, airshows, safety seminars, and training nights. Events are free to post and
            automatically removed once they end.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
            <Badge variant="outline">US-only</Badge>
            <Badge variant="secondary">Free to post</Badge>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Event Feed</h2>
            <div className="text-xs text-muted-foreground">
              {hasEvents ? `${events.length} events` : "No events posted yet"}
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Loading events…</CardContent>
            </Card>
          ) : hasEvents ? (
            <div className="grid gap-4 md:grid-cols-2">
              {eventSummary.map((event) => (
                <Card
                  key={event.id}
                  className="relative overflow-hidden border-primary/10 hover:shadow-md transition-shadow"
                >
                  {event.isSample && (
                    <>
                      <Badge className="absolute right-4 top-4" variant="secondary">
                        SAMPLE
                      </Badge>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-bold text-primary/10">
                        SAMPLE
                      </div>
                    </>
                  )}
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <CardDescription>{formatDateRange(event.startDate, event.endDate)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{event.category}</Badge>
                      {event.eventUrl && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Website
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    <Button variant="outline" size="sm" onClick={() => setSelectedEvent(event)}>
                      View details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No upcoming events yet. Be the first to post a fly-in, safety seminar, or community meetup.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Post an event</CardTitle>
              <CardDescription>
                Events are free to list. Please post only aviation-related community events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isAuthenticated ? (
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>Sign in to add an aviation event.</p>
                  <Button asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Event title</label>
                    <Input
                      value={formState.title}
                      onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Hill Country Fly-In Breakfast"
                    />
                    {formErrors.title && <p className="text-xs text-red-500">{formErrors.title}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Category</label>
                    <Select
                      value={formState.category}
                      onValueChange={(value) =>
                        setFormState((prev) => ({ ...prev, category: value as typeof formState.category }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.category && <p className="text-xs text-red-500">{formErrors.category}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Location</label>
                    <Input
                      value={formState.location}
                      onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="KGTU - Georgetown, TX"
                    />
                    {formErrors.location && <p className="text-xs text-red-500">{formErrors.location}</p>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Start date</label>
                      <Input
                        type="date"
                        value={formState.startDate}
                        onChange={(event) => setFormState((prev) => ({ ...prev, startDate: event.target.value }))}
                      />
                      {formErrors.startDate && <p className="text-xs text-red-500">{formErrors.startDate}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">End date</label>
                      <Input
                        type="date"
                        value={formState.endDate}
                        onChange={(event) => setFormState((prev) => ({ ...prev, endDate: event.target.value }))}
                      />
                      {formErrors.endDate && <p className="text-xs text-red-500">{formErrors.endDate}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Event description</label>
                    <Textarea
                      value={formState.description}
                      onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                      rows={5}
                      placeholder="Include schedule highlights, briefing time, airport procedures, or RSVP info."
                    />
                    {formErrors.description && <p className="text-xs text-red-500">{formErrors.description}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Event link (optional)</label>
                    <Input
                      value={formState.eventUrl}
                      onChange={(event) => setFormState((prev) => ({ ...prev, eventUrl: event.target.value }))}
                      placeholder="https://"
                    />
                    {formErrors.eventUrl && <p className="text-xs text-red-500">{formErrors.eventUrl}</p>}
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={formState.aviationOnly}
                      onCheckedChange={(value) =>
                        setFormState((prev) => ({ ...prev, aviationOnly: Boolean(value) }))
                      }
                    />
                    <div className="text-sm text-muted-foreground">
                      I confirm this is an aviation-only event (fly-in, airshow, safety seminar, training, or meetup).
                    </div>
                  </div>
                  {formErrors.aviationOnly && (
                    <p className="text-xs text-red-500">{formErrors.aviationOnly}</p>
                  )}
                  <Button type="submit" disabled={mutation.isPending} className="w-full">
                    {mutation.isPending ? "Posting..." : "Post event"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => (!open ? setSelectedEvent(null) : null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              {selectedEvent ? formatDateRange(selectedEvent.startDate, selectedEvent.endDate) : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedEvent.category}</Badge>
                {selectedEvent.isSample && <Badge variant="secondary">Sample event</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {selectedEvent.location}
              </div>
              <p>{selectedEvent.description}</p>
              {selectedEvent.eventUrl && (
                <Button asChild variant="outline">
                  <a href={selectedEvent.eventUrl} target="_blank" rel="noreferrer">
                    Visit event site
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
