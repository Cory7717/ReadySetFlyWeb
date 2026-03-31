import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { MutableRefObject } from "react";

interface LandingEvent {
  id: string;
  title: string;
  category?: string | null;
  startDate: string;
  endDate: string;
  location?: string | null;
  imageUrl?: string | null;
  isSample?: boolean;
}

interface LandingEventsRailProps {
  feedEvents: LandingEvent[];
  eventsScrollRef: MutableRefObject<HTMLDivElement | null>;
  formatEventRange: (start: string, end: string) => string;
  onHoveringChange: (hovering: boolean) => void;
  onPauseAutoScroll: () => void;
  onScroll: (direction: "left" | "right") => void;
  onEventClick: () => void;
}

export function LandingEventsRail({
  feedEvents,
  eventsScrollRef,
  formatEventRange,
  onHoveringChange,
  onPauseAutoScroll,
  onScroll,
  onEventClick,
}: LandingEventsRailProps) {
  return (
    <div className="container mx-auto px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-[#7A9BB8]">
            <CalendarDays className="h-4 w-4 text-[#9FC6EA]" />
            Community Calendar
          </div>
          <h2 className="text-2xl font-semibold text-[#F1F5FA]">Upcoming Aviation Events</h2>
          <p className="text-sm text-[#7A9BB8]">
            Share fly-ins, safety seminars, and airshows with the RSF community.
          </p>
        </div>
        <Button variant="outline" asChild className="border-[#29415e] bg-[#102236] text-[#E8EDF4] hover:bg-[#15304b]">
          <Link href="/events">View all events</Link>
        </Button>
      </div>

      {feedEvents.length ? (
        <div className="relative mt-6 rounded-[1.3rem] border border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.78)]">
          <div className="absolute -left-4 top-1/2 z-10 hidden -translate-y-1/2 sm:flex">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Scroll events left"
              onClick={() => onScroll("left")}
              className="h-10 w-10 rounded-full border border-[#29415e] bg-[#102236] text-[#E8EDF4] shadow-lg hover:bg-[#15304b]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 sm:flex">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Scroll events right"
              onClick={() => onScroll("right")}
              className="h-10 w-10 rounded-full border border-[#29415e] bg-[#102236] text-[#E8EDF4] shadow-lg hover:bg-[#15304b]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div
            ref={eventsScrollRef}
            onMouseEnter={() => onHoveringChange(true)}
            onMouseLeave={() => onHoveringChange(false)}
            onPointerDown={onPauseAutoScroll}
            onTouchStart={onPauseAutoScroll}
            className="events-scroll flex gap-4 overflow-x-auto px-4 py-4 scroll-smooth snap-x snap-mandatory"
          >
            {feedEvents.map((event) => (
              <Link key={event.id} href="/events" onClick={onEventClick}>
                <div className="min-w-[260px] snap-start overflow-hidden rounded-[1rem] border border-[#29415e] bg-[linear-gradient(180deg,rgba(13,22,34,0.98),rgba(17,28,42,0.96))] shadow-sm transition-shadow hover:shadow-[0_20px_48px_-28px_rgba(0,0,0,0.8)]">
                  {event.imageUrl && (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="h-28 w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="border-[#29415e] bg-[#102236] text-[#9FC6EA]">
                        {event.category}
                      </Badge>
                      {event.isSample && (
                        <Badge variant="secondary" className="border-[#5b4520] bg-[#271d0b] text-[10px] text-[#ffd278]">
                          SAMPLE
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 font-semibold text-[#F1F5FA]">{event.title}</div>
                    <div className="text-xs text-[#9FC6EA]" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatEventRange(event.startDate, event.endDate)}
                    </div>
                    <div className="mt-1 text-xs text-[#7A9BB8]">{event.location}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card className="mt-6 border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] text-[#7A9BB8]">
          <CardContent className="p-6 text-sm">
            No events posted yet. Add a fly-in or safety seminar to kick things off.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
