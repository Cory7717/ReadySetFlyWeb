import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RSF_TOOLS } from "@/lib/tool-registry";
import { apiUrl } from "@/lib/api";
import {
  AVIATION_BRIEFING_CATEGORIES,
  AVIATION_BRIEFING_STATUSES,
  AVIATION_CONTRIBUTOR_ROLES,
  type AviationBriefingInput,
  type BriefingBlock,
  type BriefingContributor,
} from "@shared/config/aviationBriefings";

const field =
  "border-[#607895] bg-[#0b1624] text-white placeholder:text-[#7f92aa]";

function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: BriefingBlock[];
  onChange: (blocks: BriefingBlock[]) => void;
}) {
  const update = (index: number, block: BriefingBlock) =>
    onChange(
      blocks.map((item, itemIndex) => (itemIndex === index ? block : item)),
    );
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    onChange(reordered);
  };
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div
          key={index}
          className="rounded-lg border border-[#526b8d]/40 bg-[#101c2c] p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8eb9ed]">
              {block.type} · Block {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#b9d6fb] disabled:text-[#65768a]" disabled={index === 0} aria-label={`Move ${block.type} block up`} title="Move block up" onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#b9d6fb] disabled:text-[#65768a]" disabled={index === blocks.length - 1} aria-label={`Move ${block.type} block down`} title="Move block down" onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#ff9c9c]" aria-label={`Delete ${block.type} block`} title="Delete block" onClick={() => onChange(blocks.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          {(block.type === "paragraph" ||
            block.type === "heading" ||
            block.type === "quote") && (
            <Textarea
              className={field}
              value={block.text}
              onChange={(event) =>
                update(index, { ...block, text: event.target.value })
              }
              rows={block.type === "paragraph" ? 5 : 2}
            />
          )}
          {block.type === "quote" && (
            <Input
              className={`mt-2 ${field}`}
              placeholder="Attribution (optional)"
              value={block.attribution || ""}
              onChange={(event) =>
                update(index, { ...block, attribution: event.target.value })
              }
            />
          )}
          {block.type === "list" && (
            <Textarea
              className={field}
              value={block.items.join("\n")}
              onChange={(event) =>
                update(index, {
                  ...block,
                  items: event.target.value.split("\n"),
                })
              }
              placeholder="One item per line"
              rows={5}
            />
          )}
          {block.type === "image" && (
            <div className="grid gap-2">
              <Input
                className={field}
                placeholder="Image URL"
                value={block.url}
                onChange={(event) =>
                  update(index, { ...block, url: event.target.value })
                }
              />
              <Input
                className={field}
                placeholder="Alt text (required)"
                value={block.alt}
                onChange={(event) =>
                  update(index, { ...block, alt: event.target.value })
                }
              />
              <Input
                className={field}
                placeholder="Caption"
                value={block.caption || ""}
                onChange={(event) =>
                  update(index, { ...block, caption: event.target.value })
                }
              />
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...blocks, { type: "paragraph", text: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" />
          Paragraph
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange([...blocks, { type: "heading", level: 2, text: "" }])
          }
        >
          Heading
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange([...blocks, { type: "list", ordered: false, items: [""] }])
          }
        >
          List
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...blocks, { type: "quote", text: "" }])}
        >
          Quote
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange([...blocks, { type: "image", url: "https://", alt: "" }])
          }
        >
          Image
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...blocks, { type: "separator" }])}
        >
          Separator
        </Button>
      </div>
    </div>
  );
}

function ContributorEditor({
  contributors,
  onChange,
}: {
  contributors: BriefingContributor[];
  onChange: (items: BriefingContributor[]) => void;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const update = (index: number, values: Partial<BriefingContributor>) =>
    onChange(
      contributors.map((item, i) =>
        i === index ? { ...item, ...values } : item,
      ),
    );
  const uploadPhoto = async (index: number, file: File) => {
    setUploadingIndex(index);
    setUploadError("");
    try {
      const uploaded = await fetch(apiUrl("/api/admin/aviation-briefings/upload-direct"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const prepared = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok) throw new Error(prepared.error || "Photo upload failed");
      update(index, { profileImageUrl: prepared.publicUrl });
    } catch (error: any) {
      setUploadError(
        error?.message || "Contributor photo upload failed. Please try again.",
      );
    } finally {
      setUploadingIndex(null);
    }
  };
  return (
    <div className="space-y-3">
      {contributors.map((person, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg border border-[#526b8d]/40 bg-[#101c2c] p-4 sm:grid-cols-2"
        >
          <div>
            <Label>Name</Label>
            <Input
              className={field}
              value={person.name}
              onChange={(event) => update(index, { name: event.target.value })}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select
              value={person.role}
              onValueChange={(role: BriefingContributor["role"]) =>
                update(index, { role })
              }
            >
              <SelectTrigger className={field}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVIATION_CONTRIBUTOR_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Professional title</Label>
            <Input
              className={field}
              value={person.professionalTitle || ""}
              onChange={(event) =>
                update(index, { professionalTitle: event.target.value })
              }
            />
          </div>
          <div>
            <Label>Aviation credentials (exact wording)</Label>
            <Input
              className={field}
              value={person.aviationCredentials || ""}
              onChange={(event) =>
                update(index, { aviationCredentials: event.target.value })
              }
            />
          </div>
          <div>
            <Label>Organization</Label>
            <Input
              className={field}
              value={person.organization || ""}
              onChange={(event) =>
                update(index, { organization: event.target.value })
              }
            />
          </div>
          <div>
            <Label>Profile URL</Label>
            <Input
              className={field}
              value={person.profileUrl || ""}
              onChange={(event) =>
                update(index, { profileUrl: event.target.value })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Contributor Photo</Label>
            <div className="mt-2 flex flex-col gap-4 rounded-lg border border-[#526b8d]/40 bg-[#0b1624] p-4 sm:flex-row sm:items-center">
              {person.profileImageUrl ? (
                <img
                  src={apiUrl(person.profileImageUrl)}
                  alt={`Photo of ${person.name || "contributor"}`}
                  className="h-24 w-24 shrink-0 rounded-full border border-[#6683a8] object-cover"
                />
              ) : (
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[#6683a8] bg-[#18283c] text-[#9db3cb]"
                  aria-label="Default contributor avatar"
                >
                  <UserRound className="h-11 w-11" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  aria-label="Contributor photo URL"
                  className={field}
                  placeholder="Existing image URL (optional)"
                  value={person.profileImageUrl || ""}
                  onChange={(event) =>
                    update(index, { profileImageUrl: event.target.value })
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md bg-[#347edc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#438ce6] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#8dbbfa]">
                    <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                    {uploadingIndex === index
                      ? "Uploading..."
                      : person.profileImageUrl
                        ? "Replace photo"
                        : "Upload photo"}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingIndex !== null}
                      aria-label={`Upload photo for ${person.name || "contributor"}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void uploadPhoto(index, file);
                      }}
                    />
                  </label>
                  {person.profileImageUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => update(index, { profileImageUrl: "" })}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove photo
                    </Button>
                  )}
                </div>
                <p className="text-xs text-[#9fb0c4]">
                  JPG, PNG, or WebP up to 10 MB. Stored in durable RSF media
                  storage.
                </p>
              </div>
            </div>
            {uploadError && (
              <p role="alert" className="mt-2 text-sm text-red-300">
                {uploadError}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Biography</Label>
            <Textarea
              className={field}
              value={person.bio || ""}
              onChange={(event) => update(index, { bio: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() =>
                onChange(contributors.filter((_, i) => i !== index))
              }
            >
              Remove contributor
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...contributors,
            {
              name: "",
              role: "Author",
              professionalTitle: "",
              aviationCredentials: "",
              bio: "",
              profileImageUrl: "",
              organization: "",
              profileUrl: "",
              credentialVerificationNote: "",
              websiteUrl: "",
              youtubeUrl: "",
              vimeoUrl: "",
              linkedinUrl: "",
            },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        Add contributor
      </Button>
    </div>
  );
}

export function BriefingEditor({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: AviationBriefingInput;
  onChange: (value: AviationBriefingInput) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [featuredUploadError, setFeaturedUploadError] = useState("");
  const update = <K extends keyof AviationBriefingInput>(
    key: K,
    next: AviationBriefingInput[K],
  ) => onChange({ ...value, [key]: next });
  const uploadImage = async (file: File) => {
    setUploading(true);
    setFeaturedUploadError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const uploaded = await fetch(apiUrl("/api/admin/aviation-briefings/upload-direct"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal,
      });
      const prepared = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok) throw new Error(prepared.error || "Image upload failed");
      onChange({
        ...value,
        featuredImageStorageKey: prepared.key,
        featuredImageUrl: prepared.publicUrl,
      });
    } catch (error: any) {
      setFeaturedUploadError(error?.name === "AbortError" ? "The upload timed out after 60 seconds. Please check the connection and try again." : error?.message || "Featured image upload failed. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      setUploading(false);
    }
  };
  return (
    <div className="space-y-8 text-[#edf5ff]">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input
            className={field}
            value={value.title}
            onChange={(event) => {
              const title = event.target.value;
              onChange({
                ...value,
                title,
                slug:
                  value.slug ||
                  title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
              });
            }}
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input
            className={field}
            value={value.slug}
            onChange={(event) =>
              update(
                "slug",
                event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              )
            }
          />
        </div>
        <div>
          <Label>Category</Label>
          <Input
            className={field}
            value={value.category}
            list="briefing-categories"
            onChange={(event) => update("category", event.target.value)}
          />
          <datalist id="briefing-categories">
            {AVIATION_BRIEFING_CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <Label>Excerpt</Label>
          <Textarea
            className={field}
            value={value.excerpt}
            onChange={(event) => update("excerpt", event.target.value)}
          />
        </div>
        <div>
          <Label>Content type</Label>
          <Select
            value={value.contentType}
            onValueChange={(next: "article" | "video") =>
              update("contentType", next)
            }
          >
            <SelectTrigger className={field}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={value.status}
            onValueChange={(next: AviationBriefingInput["status"]) =>
              update("status", next)
            }
          >
            <SelectTrigger className={field}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVIATION_BRIEFING_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
      <section>
        <h3 className="mb-4 text-xl font-bold">Featured media</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {value.featuredImageUrl && <figure className="sm:col-span-2"><img src={apiUrl(value.featuredImageUrl)} alt={value.featuredImageAlt || "Featured image preview"} className="max-h-80 w-full rounded-xl border border-[#607895] object-cover" /><figcaption className="mt-2 text-sm text-[#9fb0c4]">Featured image preview</figcaption></figure>}
          <div>
            <Label>External image URL</Label>
            <Input
              className={field}
              value={value.featuredImageUrl}
              onChange={(event) =>
                update("featuredImageUrl", event.target.value)
              }
            />
          </div>
          <div>
            <Label>Image alt text</Label>
            <Input
              className={field}
              value={value.featuredImageAlt}
              onChange={(event) =>
                update("featuredImageAlt", event.target.value)
              }
            />
          </div>
          <div>
            <Label>Photo credit</Label>
            <Input
              className={field}
              placeholder="Photographer, organization, or image provider"
              value={value.featuredImageCredit}
              onChange={(event) => update("featuredImageCredit", event.target.value)}
            />
          </div>
          <div>
            <Label>Photo credit link (optional)</Label>
            <Input
              className={field}
              type="url"
              placeholder="https://"
              value={value.featuredImageCreditUrl}
              onChange={(event) => update("featuredImageCreditUrl", event.target.value)}
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#6683a8] px-4 py-2 text-sm font-semibold">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload image to S3"}
            <input
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(file);
              }}
            />
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={value.isFeatured}
              onCheckedChange={(checked) =>
                update("isFeatured", checked === true)
              }
            />
            Featured briefing
          </label>
          {featuredUploadError && <p role="alert" className="sm:col-span-2 rounded-md border border-red-400/60 bg-red-950/50 p-3 text-sm text-red-100">{featuredUploadError}</p>}
        </div>
      </section>
      {value.contentType === "video" && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Video provider</Label>
            <Select
              value={value.videoSourceType || "youtube"}
              onValueChange={(next: "youtube" | "vimeo") =>
                update("videoSourceType", next)
              }
            >
              <SelectTrigger className={field}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>External video URL</Label>
            <Input
              className={field}
              value={value.videoUrl}
              onChange={(event) => update("videoUrl", event.target.value)}
            />
          </div>
          <div>
            <Label>Duration in seconds</Label>
            <Input
              className={field}
              type="number"
              value={value.videoDurationSeconds ?? ""}
              onChange={(event) =>
                update(
                  "videoDurationSeconds",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Transcript</Label>
            <Textarea
              className={field}
              rows={8}
              value={value.videoTranscript}
              onChange={(event) =>
                update("videoTranscript", event.target.value)
              }
            />
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-xl font-bold">
          {value.contentType === "article"
            ? "Article content"
            : "Supporting content"}
        </h3>
        <p className="mb-4 text-sm text-[#9fb0c4]">
          Formatting: <code>**bold**</code>, <code>*italics*</code>, and{" "}
          <code>[link text](https://example.com)</code>. External links are
          restricted to HTTPS/HTTP URLs.
        </p>
        <BlockEditor
          blocks={
            value.contentType === "article"
              ? value.articleContent
              : value.supportingContent
          }
          onChange={(blocks) =>
            update(
              value.contentType === "article"
                ? "articleContent"
                : "supportingContent",
              blocks,
            )
          }
        />
      </section>
      <section>
        <h3 className="mb-2 text-xl font-bold">Contributors and reviewers</h3>
        <p className="mb-4 text-sm text-[#aebdce]">
          Titles and credentials are displayed exactly as entered. RSF never
          infers qualifications.
        </p>
        <ContributorEditor
          contributors={value.contributors}
          onChange={(items) => update("contributors", items)}
        />
      </section>
      <section>
        <h3 className="mb-4 text-xl font-bold">Relevant RSF tools</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {RSF_TOOLS.map((tool) => (
            <label
              key={tool.id}
              className="flex items-start gap-3 rounded-lg border border-[#526b8d]/35 p-3"
            >
              <Checkbox
                checked={value.relevantToolIds.includes(tool.id)}
                onCheckedChange={(checked) =>
                  update(
                    "relevantToolIds",
                    checked
                      ? [...value.relevantToolIds, tool.id]
                      : value.relevantToolIds.filter((id) => id !== tool.id),
                  )
                }
              />
              <span>
                <span className="block font-semibold">{tool.title}</span>
                <span className="text-xs text-[#9fb0c4]">
                  {tool.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>SEO title</Label>
          <Input
            className={field}
            value={value.seoTitle}
            onChange={(event) => update("seoTitle", event.target.value)}
          />
        </div>
        <div>
          <Label>SEO description</Label>
          <Input
            className={field}
            value={value.seoDescription}
            onChange={(event) => update("seoDescription", event.target.value)}
          />
        </div>
        <div>
          <Label>Published date</Label>
          <Input
            className={field}
            type="datetime-local"
            value={value.publishedAt ? value.publishedAt.slice(0, 16) : ""}
            onChange={(event) =>
              update(
                "publishedAt",
                event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              )
            }
          />
        </div>
        <div>
          <Label>Scheduled date</Label>
          <Input
            className={field}
            type="datetime-local"
            value={value.scheduledAt ? value.scheduledAt.slice(0, 16) : ""}
            onChange={(event) =>
              update(
                "scheduledAt",
                event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              )
            }
          />
        </div>
      </section>
      <div className="sticky bottom-4 flex justify-end">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-[#347edc] px-8 text-white hover:bg-[#438ce6]"
        >
          {saving ? "Saving…" : "Save briefing"}
        </Button>
      </div>
    </div>
  );
}
