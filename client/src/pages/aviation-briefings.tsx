import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen, Camera, Search } from "lucide-react";
import { BriefingCard } from "@/components/aviation-briefings/BriefingCard";
import { BriefingSubscribe } from "@/components/aviation-briefings/BriefingSubscribe";
import type { AviationBriefing } from "@/components/aviation-briefings/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load Ready Set Fly Briefings");
  return response.json();
}

export default function AviationBriefingsPage() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [category, setCategory] = useState("");
  const query = new URLSearchParams({ limit: "24" });
  if (submittedSearch) query.set("search", submittedSearch);
  if (category) query.set("category", category);
  const { data, isLoading } = useQuery<{
    briefings: AviationBriefing[];
    total: number;
  }>({
    queryKey: ["/api/aviation-briefings", submittedSearch, category],
    queryFn: () => getJson(`/api/aviation-briefings?${query}`),
  });
  const { data: categoryData } = useQuery<{ categories: string[] }>({
    queryKey: ["/api/aviation-briefings/categories"],
    queryFn: () => getJson("/api/aviation-briefings/categories"),
  });
  useEffect(() => {
    document.title = "Ready Set Fly | Briefings";
    trackEvent("aviation_briefings_view");
  }, []);
  const briefings = data?.briefings || [];
  const featured =
    !submittedSearch && !category
      ? briefings.find((item) => item.isFeatured)
      : undefined;
  const latest = featured
    ? briefings.filter((item) => item.id !== featured.id)
    : briefings;

  return (
    <main className="min-h-screen bg-[#07101c] text-[#eef5ff]">
      <section className="border-b border-[#56729a]/30 bg-[radial-gradient(circle_at_top_right,rgba(38,98,182,.28),transparent_42%)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[.24em] text-[#87b9ff]">
            <BookOpen className="h-5 w-5" />
            Ready Set Fly
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl">
            Ready Set Fly | Briefings
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#bdcadb]">
            Practical aviation insights, platform walkthroughs, educational
            content, and perspectives from experienced aviation
            professionals—built to make complex workflows easier to understand.
          </p>
          <form
            className="mt-9 flex max-w-2xl gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(search.trim());
              trackEvent("aviation_briefing_search", { query: search.trim() });
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7890ad]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 border-[#5d7697] bg-[#0c1726] pl-12 text-white placeholder:text-[#8191a7]"
                placeholder="Search briefings"
                aria-label="Search Ready Set Fly Briefings"
              />
            </div>
            <Button className="h-12 bg-[#2d73d5] px-6 text-white hover:bg-[#3d84e8]">
              Search
            </Button>
          </form>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {new URLSearchParams(window.location.search).get("subscription")&&<div className="mb-6 rounded-lg border border-[#55739b]/40 bg-[#10233a] p-4 text-[#dbeafe]">{new URLSearchParams(window.location.search).get("subscription")==="confirmed"?"Your Ready Set Fly | Briefings subscription is confirmed.":new URLSearchParams(window.location.search).get("subscription")==="unsubscribed"?"You have been unsubscribed from Ready Set Fly | Briefings emails.":"That subscription link is invalid or has already been used."}</div>}
        <div className="mb-10"><BriefingSubscribe source="briefings-index" /></div>
        <section className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#526d94]/35 bg-[#0c1624] p-5">
          <div>
            <h2 className="flex items-center text-xl font-bold">
              <Camera className="mr-2 h-5 w-5 text-[#87b9ff]" />
              Contribute to Ready Set Fly | Briefings
            </h2>
            <p className="mt-1 text-sm text-[#aebdce]">
              Share original aviation photography, a story idea, or firsthand
              experience with the editorial team.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/briefings/contribute">
              Submit a photograph
            </Link>
          </Button>
        </section>
        <div
          className="mb-10 flex gap-2 overflow-x-auto pb-2"
          aria-label="Briefing categories"
        >
          <button
            onClick={() => setCategory("")}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${!category ? "border-[#75aaf1] bg-[#245ea8] text-white" : "border-[#516a8b] text-[#c9d6e5] hover:bg-[#14243a]"}`}
          >
            All
          </button>
          {(categoryData?.categories || []).map((item) => (
            <button
              key={item}
              onClick={() => {
                setCategory(item);
                trackEvent("aviation_briefing_category_selected", {
                  category: item,
                });
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${category === item ? "border-[#75aaf1] bg-[#245ea8] text-white" : "border-[#516a8b] text-[#c9d6e5] hover:bg-[#14243a]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="py-20 text-center text-[#a9b8ca]">
            Loading briefings…
          </div>
        ) : briefings.length === 0 ? (
          <div className="rounded-2xl border border-[#526d94]/35 bg-[#0c1522] px-6 py-20 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-[#76a9ed]" />
            <h2 className="mt-5 text-2xl font-bold">
              Ready Set Fly | Briefings are coming soon.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-[#afbdce]">
              Practical aviation insights, planning guidance, educational
              articles, expert perspectives, and Ready Set Fly walkthroughs are
              currently being prepared.
            </p>
          </div>
        ) : (
          <>
            {featured && (
              <section className="mb-14">
                <div className="mb-5 text-sm font-bold uppercase tracking-[.2em] text-[#86b8f9]">
                  Featured Briefing
                </div>
                <BriefingCard briefing={featured} featured />
              </section>
            )}
            <section>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-[.2em] text-[#86b8f9]">
                    Latest Briefings
                  </div>
                  <h2 className="mt-2 text-3xl font-bold">
                    Knowledge for the next flight
                  </h2>
                </div>
                <span className="text-sm text-[#95a8bf]">
                  {data?.total || 0} briefing{data?.total === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {latest.map((briefing) => (
                  <BriefingCard key={briefing.id} briefing={briefing} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
