import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Images } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Submission = Record<string, any>;
export function PhotoSubmissionAdmin() {
  const [status, setStatus] = useState("pending");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/aviation-briefings/photo-submissions"],
    queryFn: async () => {
      const r = await fetch(
        apiUrl("/api/admin/aviation-briefings/photo-submissions"),
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Unable to load photo submissions");
      return r.json();
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Record<string, unknown>;
    }) =>
      apiRequest(
        "PATCH",
        `/api/admin/aviation-briefings/photo-submissions/${id}`,
        values,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/aviation-briefings/photo-submissions"],
      }),
  });
  const rows = (data?.submissions || []).filter(
    (x: Submission) => status === "all" || x.reviewStatus === status,
  );
  return (
    <section className="mt-8 rounded-xl border border-[#526d94]/40 bg-[#0c1624] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center text-2xl font-bold">
            <Images className="mr-2 h-6 w-6 text-[#87b8f7]" />
            Community photo submissions
          </h2>
      <p className="mt-1 text-sm text-[#9fb0c4]">
        Private editorial review and permission records.
      </p>
      <p className="mt-1 text-xs text-amber-200/90">
        Originals may contain EXIF or GPS metadata. Strip metadata from any public derivative before publication.
      </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded border border-[#607895] bg-[#0b1624] px-3"
        >
          {[
            "pending",
            "approved",
            "needs_information",
            "published",
            "declined",
            "withdrawn",
            "all",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <p className="mt-5">Loading…</p>
      ) : (
        <div className="mt-5 space-y-5">
          {rows.length === 0 ? (
            <p className="text-[#9fb0c4]">No submissions in this status.</p>
          ) : (
            rows.map((row: Submission) => (
              <SubmissionCard
                key={row.id}
                row={row}
                briefings={data.briefings || []}
                update={(values) => update.mutate({ id: row.id, values })}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
function SubmissionCard({
  row,
  briefings,
  update,
}: {
  row: Submission;
  briefings: Array<{ id: string; title: string }>;
  update: (v: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => ({
    reviewStatus: row.reviewStatus,
    internalNotes: row.internalNotes || "",
    publicationStatus: row.publicationStatus,
    associatedBriefingId: row.associatedBriefingId || "",
    publishedImageUrl: row.publishedImageUrl || "",
    finalCreditLine: row.finalCreditLine || row.preferredCredit || "",
    altText: row.altText || "",
    caption: row.caption || "",
    imageTitle: row.imageTitle || "",
    relevantAircraftType:
      row.relevantAircraftType || row.aircraftMakeModel || "",
    relevantAirport: row.relevantAirport || row.homeAirport || "",
  }));
  const image = apiUrl(
    `/api/admin/aviation-briefings/photo-submissions/${row.id}/image`,
  );
  return (
    <article className="rounded-xl border border-[#526d94]/35 bg-[#101b2a] p-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,380px)_1fr]">
        <div>
          <img
            src={image}
            alt="Private submitted photograph preview"
            className="max-h-80 w-full rounded-lg bg-black object-contain"
          />
          <Button asChild size="sm" variant="outline" className="mt-3">
            <a href={`${image}?download=1`}>
              <Download className="mr-2 h-4 w-4" />
              Download original
            </a>
          </Button>
        </div>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-bold">{row.preferredCredit}</h3>
              <p className="text-sm text-[#9fb0c4]">
                Reference {row.id} · {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <strong className="rounded-full bg-[#193763] px-3 py-1 text-xs uppercase">
              {row.reviewStatus}
            </strong>
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Contributor" value={row.contributorName} />
            <Info label="Email" value={row.contributorEmail} />
            <Info label="Phone" value={row.phone} />
            <Info label="Home airport" value={row.homeAirport} />
            <Info label="City/state" value={row.cityState} />
            <Info
              label="Aircraft"
              value={[row.aircraftMakeModel, row.aircraftRegistration]
                .filter(Boolean)
                .join(" · ")}
            />
            <Info
              label="Photo location/date"
              value={[row.photoLocation, row.dateTaken]
                .filter(Boolean)
                .join(" · ")}
            />
            <Info label="Profile" value={row.profileUrl} />
          </div>
          {row.description && (
            <p className="mt-4">
              <b>Description:</b> {row.description}
            </p>
          )}
          {row.storyContext && (
            <p className="mt-3 whitespace-pre-line">
              <b>Story/context:</b> {row.storyContext}
            </p>
          )}
          {row.identifiablePeople && (
            <p className="mt-3">
              <b>Identifiable people:</b> {row.identifiablePeople}
            </p>
          )}
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm">
            <b>Permission accepted:</b> {row.permissionAccepted ? "Yes" : "No"}{" "}
            · <b>Ownership confirmed:</b>{" "}
            {row.ownershipConfirmed ? "Yes" : "No"}
            <br />
            <b>Agreement:</b> {row.permissionVersion} ·{" "}
            {new Date(row.consentedAt).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Edit label="Review status">
          <select
            value={form.reviewStatus}
            onChange={(e) => setForm({ ...form, reviewStatus: e.target.value })}
            className="h-10 w-full rounded border border-[#607895] bg-[#0b1624] px-2"
          >
            {[
              "pending",
              "approved",
              "declined",
              "needs_information",
              "published",
              "withdrawn",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Edit>
        <Edit label="Publication status">
          <select
            value={form.publicationStatus}
            onChange={(e) =>
              setForm({ ...form, publicationStatus: e.target.value })
            }
            className="h-10 w-full rounded border border-[#607895] bg-[#0b1624] px-2"
          >
            {["unpublished", "published", "withdrawn"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Edit>
        <Edit label="Associated briefing">
          <select
            value={form.associatedBriefingId}
            onChange={(e) =>
              setForm({ ...form, associatedBriefingId: e.target.value })
            }
            className="h-10 w-full rounded border border-[#607895] bg-[#0b1624] px-2"
          >
            <option value="">None</option>
            {briefings.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </Edit>
        {[
          ["imageTitle", "Image title"],
          ["finalCreditLine", "Final credit line"],
          ["altText", "Alt text (not filename)"],
          ["caption", "Caption"],
          ["relevantAircraftType", "Relevant aircraft type"],
          ["relevantAirport", "Relevant airport"],
          ["publishedImageUrl", "Published delivery URL"],
        ].map(([key, label]) => (
          <Edit key={key} label={label}>
            <Input
              value={(form as any)[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </Edit>
        ))}
        <div className="md:col-span-3">
          <Label>Internal admin notes</Label>
          <Textarea
            className="mt-2"
            value={form.internalNotes}
            onChange={(e) =>
              setForm({ ...form, internalNotes: e.target.value })
            }
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() =>
            update({
              ...form,
              associatedBriefingId: form.associatedBriefingId || null,
              publishedImageUrl: form.publishedImageUrl || null,
            })
          }
        >
          Save review
        </Button>
        <Button
          variant="outline"
          onClick={() => navigator.clipboard.writeText(image)}
        >
          Copy authorized delivery URL
        </Button>
        {row.reviewStatus !== "withdrawn" && (
          <Button
            variant="destructive"
            onClick={() =>
              confirm("Mark withdrawn and prevent future use?") &&
              update({
                reviewStatus: "withdrawn",
                publicationStatus: "withdrawn",
              })
            }
          >
            Mark withdrawn
          </Button>
        )}
      </div>
    </article>
  );
}
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-[#8fa2b9]">{label}:</span> {value || "—"}
    </div>
  );
}
function Edit({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
