import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Camera, CheckCircle2, Upload, X } from "lucide-react";
import { AVIATION_PHOTO_PERMISSION_TEXT } from "@shared/config/aviationBriefings";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const optionalFields = [
  ["phone", "Phone number"],
  ["homeAirport", "Home airport or identifier"],
  ["cityState", "City and state"],
  ["aircraftMakeModel", "Aircraft make and model"],
  ["aircraftRegistration", "Aircraft registration number"],
  ["photoLocation", "Where was the photo taken?"],
  ["dateTaken", "Date or approximate date taken"],
  ["profileUrl", "Website or social media profile"],
  ["suggestedTopic", "Suggested briefing topic or category"],
  ["identifiablePeople", "Names of identifiable people shown"],
] as const;
export default function AviationBriefingContributePage() {
  const [photo, setPhoto] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [ownership, setOwnership] = useState(false),
    [permission, setPermission] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState(""),
    [reference, setReference] = useState("");
  const [token] = useState(() => crypto.randomUUID());
  useEffect(() => {
    document.title = "Contribute Photography | Aviation Briefings";
    trackEvent("aviation_briefings_contribute_view");
  }, []);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const validPhoto = Boolean(
    photo &&
    photo.size <= 15 * 1024 * 1024 &&
    ["image/jpeg", "image/png", "image/webp"].includes(photo.type),
  );
  const canSubmit = validPhoto && ownership && permission && !submitting;
  const choose = (file: File | null) => {
    setError("");
    setPhoto(file);
    if (file)
      trackEvent("aviation_briefings_photo_upload_selected", {
        mimeType: file.type,
        sizeBand:
          file.size > 10 * 1024 * 1024
            ? "10-15mb"
            : file.size > 5 * 1024 * 1024
              ? "5-10mb"
              : "under-5mb",
      });
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    trackEvent("aviation_briefings_photo_submission_started");
    const data = new FormData(event.currentTarget);
    data.set("submissionToken", token);
    data.set("ownershipConfirmed", "true");
    data.set("permissionAccepted", "true");
    data.set("photo", photo!);
    try {
      const response = await fetch(
        apiUrl("/api/aviation-briefings/photo-submissions"),
        { method: "POST", credentials: "include", body: data },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error || "Unable to submit the photo.");
      setReference(payload.submission.referenceNumber);
      trackEvent("aviation_briefings_photo_submission_completed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit the photo.");
      trackEvent("aviation_briefings_photo_submission_failed");
      setSubmitting(false);
    }
  }
  if (reference)
    return (
      <main className="min-h-screen bg-[#07101c] px-5 py-16 text-[#edf5ff]">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#526d94]/40 bg-[#0c1624] p-8">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <h1 className="mt-5 text-3xl font-black">
            Photo submitted for editorial review
          </h1>
          <p className="mt-4 leading-7 text-[#c3d0df]">
            Thank you for contributing to RSF Aviation Briefings. Your photo has
            been submitted for editorial review. Submission does not guarantee
            publication. If selected, we may contact you for additional
            information and will use the preferred photo credit you provided
            whenever reasonably possible.
          </p>
          <div className="mt-5 rounded-lg bg-[#111e30] p-4">
            <div className="text-xs uppercase tracking-wider text-[#8ca4c0]">
              Reference number
            </div>
            <strong className="mt-1 block break-all">{reference}</strong>
          </div>
          <p className="mt-4 text-sm text-[#9fb0c4]">
            For a correction or withdrawal request, contact Ready Set Fly and
            include this reference number.
          </p>
          <Button asChild className="mt-6">
            <Link href="/aviation-briefings">Return to Aviation Briefings</Link>
          </Button>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#07101c] px-5 py-12 text-[#edf5ff]">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/aviation-briefings"
          className="inline-flex items-center text-[#8dbbfa]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Aviation Briefings
        </Link>
        <header className="mt-7">
          <div className="flex items-center text-sm font-bold uppercase tracking-[.18em] text-[#87b8f7]">
            <Camera className="mr-2 h-5 w-5" />
            Community contributions
          </div>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Share your aviation photography
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#c3d0df]">
            RSF Aviation Briefings welcomes original aviation photography, story
            ideas, guest article proposals, interview participation, and
            firsthand aviation experiences. This form is for submitting one
            original photograph for possible editorial use.
          </p>
        </header>
        <form
          onSubmit={submit}
          className="mt-9 space-y-7 rounded-2xl border border-[#526d94]/40 bg-[#0c1624] p-5 sm:p-8"
        >
          <section>
            <h2 className="text-xl font-bold">Contributor and credit</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                name="contributorName"
                label="Contributor full name"
                required
              />
              <Field
                name="contributorEmail"
                label="Contributor email address"
                type="email"
                required
              />
              <Field
                name="preferredCredit"
                label="Preferred photo credit"
                required
                helper="Example: Photo by Jane Pilot"
              />
              {optionalFields.slice(0, 3).map(([name, label]) => (
                <Field key={name} name={name} label={label} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-bold">Photograph</h2>
            <Label htmlFor="photo" className="mt-4 block">
              Photo upload <span className="text-red-300">*</span>
            </Label>
            <p className="mt-1 text-sm text-[#9fb0c4]">
              One JPG, PNG, or WebP image, no larger than 15 MB.
            </p>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="mt-3"
              onChange={(e) => choose(e.target.files?.[0] || null)}
            />
            {photo && !validPhoto && (
              <p className="mt-2 text-sm text-red-300">
                Choose a JPG, PNG, or WebP image no larger than 15 MB.
              </p>
            )}
            {preview && (
              <div className="relative mt-4 overflow-hidden rounded-xl border border-[#526d94]/40">
                <img
                  src={preview}
                  alt="Selected photograph preview"
                  className="max-h-[32rem] w-full object-contain bg-black"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-3 top-3"
                  onClick={() => choose(null)}
                >
                  <X className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              </div>
            )}
          </section>
          <section>
            <h2 className="text-xl font-bold">Photo details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {optionalFields.slice(3).map(([name, label]) => (
                <Field key={name} name={name} label={label} />
              ))}
            </div>
            <div className="mt-4 grid gap-4">
              <Area name="description" label="Short description of the image" />
              <Area
                name="storyContext"
                label="Story or context behind the photograph"
              />
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/30 bg-[#141a22] p-5">
            <h2 className="text-xl font-bold text-amber-100">
              Image safety and privacy
            </h2>
            <p className="mt-3 leading-7 text-[#cbd5e1]">
              Please do not submit photographs featuring identifiable people in
              private or sensitive situations. If an identifiable person is a
              primary subject, you should have their permission. Do not submit
              private documents, readable pilot or medical certificates,
              personal logbooks, private aircraft records, or dangerous or
              illegal conduct presented as acceptable practice. Do not submit a
              minor as the primary subject unless you have parental or guardian
              permission.
            </p>
          </section>
          <section>
            <details
              open
              className="rounded-xl border border-[#526d94]/40 bg-[#101c2c] p-5"
            >
              <summary className="cursor-pointer text-xl font-bold">
                Photo Usage Permission
              </summary>
              <div className="mt-4 whitespace-pre-line text-sm leading-7 text-[#c3d0df]">
                {AVIATION_PHOTO_PERMISSION_TEXT.replace(
                  /^Photo Usage Permission\n+/,
                  "",
                )}
              </div>
            </details>
            <label className="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={ownership}
                onChange={(e) => setOwnership(e.target.checked)}
              />
              <span>
                I certify that I own this photograph or have legal authority to
                submit it and have obtained permission reasonably necessary for
                identifiable primary subjects.
              </span>
            </label>
            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={permission}
                onChange={(e) => {
                  setPermission(e.target.checked);
                  if (e.target.checked)
                    trackEvent("aviation_briefings_photo_permission_accepted");
                }}
              />
              <span>
                I have read and agree to the Photo Usage Permission above.
              </span>
            </label>
          </section>
          <input
            name="company"
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-400/50 bg-red-950/40 p-4 text-red-100"
            >
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="bg-[#347edc] text-white"
          >
            <Upload className="mr-2 h-4 w-4" />
            {submitting ? "Submitting…" : "Submit photo for review"}
          </Button>
          <p className="text-xs text-[#8ca0b8]">
            Submission does not guarantee publication. For corrections or
            withdrawal, contact RSF with the reference number provided after
            submission.
          </p>
        </form>
      </div>
    </main>
  );
}
function Field({
  name,
  label,
  type = "text",
  required = false,
  helper,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-red-300"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-2"
      />
      {helper && <p className="mt-1 text-xs text-[#8ca0b8]">{helper}</p>}
    </div>
  );
}
function Area({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} className="mt-2 min-h-24" />
    </div>
  );
}
