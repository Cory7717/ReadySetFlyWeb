import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  executiveManualPages,
  executiveManualSections,
  type ExecutiveManualPage as ManualPage,
} from "@/content/executiveManualContent";
import styles from "./ExecutiveManualReader.module.css";

const STORAGE_KEY = "rsf_admin_executive_manual_page";

function clampPage(index: number) {
  return Math.min(Math.max(Math.trunc(index), 0), executiveManualPages.length - 1);
}

function restorePage() {
  if (typeof window === "undefined") return 0;
  try {
    const stored = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
    return Number.isFinite(stored) ? clampPage(stored) : 0;
  } catch {
    return 0;
  }
}

function ExecutiveManualPage({ page, index }: { page: ManualPage; index: number }) {
  const isCover = page.variant === "cover";
  return (
    <article
      className={`${styles.page} ${isCover ? styles.cover : ""} flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12`}
      aria-labelledby={`manual-title-${page.id}`}
      data-testid={`executive-manual-page-${page.id}`}
    >
      {isCover ? (
        <div className="flex flex-1 flex-col justify-between pl-2 sm:pl-5">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200">
            <BookOpen className="h-5 w-5" aria-hidden="true" /> Ready Set Fly
          </div>
          <div className="max-w-3xl py-16 sm:py-24">
            <div className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-blue-300">Internal Use</div>
            <h1 id={`manual-title-${page.id}`} className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {page.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">{page.subtitle}</p>
          </div>
          <div className="border-t border-white/15 pt-5 text-xs uppercase tracking-[0.22em] text-slate-400">
            Understanding the platform, business model, strategy and long-term vision
          </div>
        </div>
      ) : (
        <>
          <header className="border-b border-slate-300/80 pb-5">
            <div className={styles.sectionLabel}>{page.part} · {page.section}</div>
            <h2 id={`manual-title-${page.id}`} className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {page.title}
            </h2>
            {page.subtitle ? <p className="mt-3 text-base text-slate-600">{page.subtitle}</p> : null}
          </header>

          <div className="flex-1 py-7 sm:py-9">
            {page.paragraphs?.length ? (
              <div className={`${styles.bodyCopy} space-y-5`}>
                {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            ) : null}

            {page.metrics?.length ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key figures">
                {page.metrics.map((metric) => (
                  <div key={`${metric.value}-${metric.label}`} className="border-t-2 border-blue-600 bg-slate-100 px-4 py-4">
                    <div className="text-2xl font-bold text-slate-950">{metric.value}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-600">{metric.label}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {page.bullets?.length ? (
              page.variant === "flywheel" ? (
                <ol className="mx-auto mt-8 max-w-xl text-center" aria-label="RSF flywheel">
                  {page.bullets.map((item) => (
                    <li key={item} className={`${styles.flywheelItem} rounded border border-blue-200 bg-blue-50 px-4 py-2.5 font-semibold text-slate-800`}>
                      {item}
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="mt-7 space-y-3">
                  {page.bullets.map((item) => (
                    <li key={item} className="flex gap-3 text-[0.98rem] leading-7 text-slate-700">
                      <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {page.keyTakeaways?.length ? (
              <div className="mt-7 flex flex-wrap gap-2" aria-label="Key takeaways">
                {page.keyTakeaways.map((item) => (
                  <span key={item} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-950">{item}</span>
                ))}
              </div>
            ) : null}

            {page.glossary?.length ? (
              <dl className="mt-2 grid gap-x-8 gap-y-4 md:grid-cols-2">
                {page.glossary.map((entry) => (
                  <div key={entry.term} className="border-b border-slate-200 pb-3">
                    <dt className="font-bold text-blue-800">{entry.term}</dt>
                    <dd className="mt-1 text-sm leading-6 text-slate-600">{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {page.callout ? <aside className={`${styles.callout} mt-8 px-5 py-4 text-base font-semibold leading-7`}>{page.callout}</aside> : null}
          </div>

          <footer className={`${styles.folio} flex items-center justify-between border-t border-slate-300/80 pt-4`}>
            <span>Ready Set Fly · Internal</span>
            <span>{index + 1} / {executiveManualPages.length}</span>
          </footer>
        </>
      )}
    </article>
  );
}

export function ExecutiveManualReader() {
  const [api, setApi] = useState<CarouselApi>();
  const [currentPage, setCurrentPage] = useState(restorePage);
  const [contentsOpen, setContentsOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const goTo = useCallback((index: number) => {
    const next = clampPage(index);
    api?.scrollTo(next);
    setCurrentPage(next);
    setContentsOpen(false);
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.scrollTo(currentPage, true);
    const onSelect = () => setCurrentPage(clampPage(api.selectedScrollSnap()));
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(currentPage));
    } catch {}
  }, [currentPage]);

  const previousDisabled = currentPage <= 0;
  const nextDisabled = currentPage >= executiveManualPages.length - 1;

  return (
    <div ref={stageRef} className={`${styles.readerStage} scroll-mt-6 rounded-lg p-2 sm:p-4 lg:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-slate-100">
        <Sheet open={contentsOpen} onOpenChange={setContentsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" data-testid="button-manual-contents">
              <ListTree className="mr-2 h-4 w-4" /> Contents
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Executive Manual Contents</SheetTitle>
              <SheetDescription>Jump directly to any chapter or reference page.</SheetDescription>
            </SheetHeader>
            <nav className="mt-6 space-y-6" aria-label="Executive manual contents">
              {executiveManualSections.map((section) => (
                <section key={section.part}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{section.part}</h3>
                  <div className="space-y-1">
                    {section.pages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => goTo(page.index)}
                        className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${page.index === currentPage ? "bg-blue-50 font-semibold text-blue-900" : ""}`}
                      >
                        <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{page.index + 1}</span>
                        <span>{page.title}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="text-sm font-medium tabular-nums" aria-live="polite" data-testid="text-manual-page-counter">
          Page {currentPage + 1} of {executiveManualPages.length}
        </div>
      </div>

      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          containScroll: "trimSnaps",
          skipSnaps: false,
          startIndex: currentPage,
          watchDrag: (_api, event) => !("pointerType" in event) || (event as PointerEvent).pointerType !== "mouse",
        }}
        className={`${styles.viewport} mx-auto max-w-5xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
        tabIndex={0}
        aria-label="RSF Executive Training Manual"
        data-testid="executive-manual-reader"
      >
        <CarouselContent className="ml-0">
          {executiveManualPages.map((page, index) => (
            <CarouselItem key={page.id} className="pl-0">
              <ExecutiveManualPage page={page} index={index} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="mx-auto mt-4 flex max-w-5xl items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => goTo(currentPage - 1)}
          disabled={previousDisabled}
          className="min-h-11 min-w-28 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
          aria-label="Previous manual page"
          data-testid="button-manual-previous"
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <Button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          disabled={nextDisabled}
          className="min-h-11 min-w-28 bg-blue-600 text-white hover:bg-blue-500"
          aria-label="Next manual page"
          data-testid="button-manual-next"
        >
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
