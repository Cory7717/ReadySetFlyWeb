import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  Building2,
  ClipboardList,
  Headphones,
  HeartPulse,
  Hotel,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SupportWidget from "@/components/hotel-operations/SupportWidget";

function csrf() {
  return decodeURIComponent(
    document.cookie
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("hotel_ops_csrf="))
      ?.slice(15) || "",
  );
}
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.method && init.method !== "GET")
    headers.set("x-hotel-ops-csrf", csrf());
  const response = await fetch(apiUrl(`/api/hotel-operations${path}`), {
    ...init,
    headers,
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
const NAV = [
  ["overview", "Overview", LayoutDashboard],
  ["organizations", "Organizations", Building2],
  ["hotels", "Hotels / Properties", Hotel],
  ["users", "Users & Access", Users],
  ["invitations", "Invitations", Mail],
  ["support", "Support Center", Headphones],
  ["sales", "Sales Inquiries", MessageSquareText],
  ["specialists", "Support Specialists", UserCog],
  ["audit", "Audit History", ClipboardList],
  ["health", "System Health", HeartPulse],
  ["settings", "Platform Settings", Settings],
] as const;
const Card = ({ label, value }: { label: string; value: any }) => (
  <div className="rounded-2xl border border-[#dcd5c8] bg-white p-5">
    <div className="text-sm text-[#65736f]">{label}</div>
    <div className="mt-2 text-3xl font-semibold">{value ?? "—"}</div>
  </div>
);

export default function HotelOperationsAdminPage() {
  const [location, navigate] = useLocation(),
    [session, setSession] = useState<any>(),
    [tab, setTab] = useState(() =>
      location.includes("/support/specialists")
        ? "specialists"
        : location.includes("/admin/support")
          ? "support"
          : location.includes("/admin/settings")
            ? "settings"
            : "overview",
    ),
    [data, setData] = useState<any>({}),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [presence, setPresence] = useState<"online" | "away">("online");
  useEffect(() => {
    api("/session")
      .then(async (s) => {
        const owner = s.organizations.some(
            (o: any) => o.role === "platform_owner",
          ),
          supportAdmin = s.supportRole === "support_administrator";
        if (!owner && !location.includes("/admin/support"))
          throw new Error("support_access_required");
        if (!owner) await api("/admin/support");
        setSession(s);
        setTab(
          owner
            ? tab
            : supportAdmin && location.includes("specialists")
              ? "specialists"
              : "support",
        );
      })
      .catch(() => navigate("/hoteloperations"));
  }, []);
  async function load() {
    setError("");
    try {
      const path: Record<string, string> = {
        overview: "/admin/overview",
        organizations: "/admin/organizations",
        hotels: "/admin/hotels",
        users: "/admin/users",
        invitations: "/admin/invitations",
        support: "/admin/support",
        sales: "/admin/sales-inquiries",
        specialists: "/admin/support-specialists",
        audit: "/audit",
        health: "/admin/overview",
        settings: "/admin/support-settings",
      };
      setData(await api(path[tab]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    }
  }
  useEffect(() => {
    if (session) {
      setSelected(null);
      void load();
    }
  }, [tab, session]);
  useEffect(() => {
    if (!session || !["support", "specialists"].includes(tab)) return;
    const heartbeat = () =>
      api("/admin/support/heartbeat", {
        method: "POST",
        body: JSON.stringify({ status: presence }),
      }).catch(() => {});
    void heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    return () => window.clearInterval(timer);
  }, [session, tab, presence]);
  async function logout() {
    await api("/logout", { method: "POST" });
    navigate("/hoteloperations");
  }
  if (!session)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f2ec]">
        Loading administration console…
      </div>
    );
  const m = data.metrics || {};
  const isOwner = session.organizations.some(
      (o: any) => o.role === "platform_owner",
    ),
    isSupportAdmin = session.supportRole === "support_administrator";
  return (
    <div className="min-h-screen bg-[#f4f2ec] text-[#17332e]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#184f46] text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <b>
                {isOwner
                  ? "INNTRIX | PLATFORM ADMINISTRATION"
                  : isSupportAdmin
                    ? "INNTRIX | PLATFORM SUPPORT"
                    : "INNTRIX | SUPPORT CONSOLE"}
              </b>
              <div className="text-xs uppercase tracking-[.18em] text-[#987438]">
                Hospitality Operations Intelligence
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/hoteloperations/dashboard")}
            >
              INNTRIX dashboard
            </Button>
            <Button variant="outline" onClick={logout}>
              <LogOut size={15} /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-6 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-2xl border border-[#ded7ca] bg-white p-3">
          <div className="mb-3 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#94723a]">
            Control center
          </div>
          {NAV.filter(
            ([key]) =>
              isOwner ||
              key === "support" ||
              (isSupportAdmin && ["sales", "specialists"].includes(key)),
          ).map(
            ([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${tab === key ? "bg-[#e8f0ed] font-semibold text-[#184f46]" : "text-[#586863] hover:bg-[#f5f2ec]"}`}
              >
                <Icon size={17} />
                {label}
              </button>
            ),
          )}
        </aside>
        <main>
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-widest text-[#987438]">
              {isOwner
                ? "Platform Owner"
                : isSupportAdmin
                  ? "Support Administrator"
                  : "Support Specialist"}
            </div>
            <h1 className="mt-1 text-3xl font-semibold">
              {NAV.find(([key]) => key === tab)?.[1]}
            </h1>
          </div>
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {tab === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card label="Organizations" value={m.organizations} />
                <Card label="Hotels" value={m.hotels} />
                <Card label="Active users" value={m.activeUsers} />
                <Card
                  label="Pending invitations"
                  value={m.pendingInvitations}
                />
                <Card label="Active support" value={m.activeSupport} />
                <Card label="Unanswered chats" value={m.unansweredChats} />
                <Card label="Open tickets" value={m.openTickets} />
              </div>
              <Panel title="Recent administrative activity">
                {(data.activity || []).map((x: any) => (
                  <Row
                    key={x.id}
                    primary={String(x.action).replaceAll("_", " ")}
                    secondary={new Date(x.createdAt).toLocaleString()}
                  />
                ))}
              </Panel>
            </>
          )}
          {tab === "organizations" && (
            <Organizations data={data} reload={load} />
          )}
          {tab === "hotels" && (
            <Panel title="Properties">
              {(data.hotels || []).map((x: any) => (
                <Row
                  key={x.hotel.id}
                  primary={x.hotel.name}
                  secondary={`${x.organization.name} · ${x.hotel.propertyCode} · ${x.hotel.status}`}
                />
              ))}
            </Panel>
          )}
          {tab === "users" && (
            <Panel title="Enterprise users">
              {(data.users || []).map((x: any) => (
                <div
                  key={x.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
                >
                  <div>
                    <b>{x.displayName}</b>
                    <div className="text-sm text-[#687671]">
                      {x.email} ·{" "}
                      {x.organizations.map((o: any) => o.role).join(", ")} ·{" "}
                      {x.hotels.length} properties
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={x.id === session.account.id}
                    onClick={async () => {
                      await api(`/admin/users/${x.id}/status`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          status: x.status === "active" ? "inactive" : "active",
                        }),
                      });
                      await load();
                    }}
                  >
                    {x.status === "active" ? "Deactivate" : "Restore"}
                  </Button>
                </div>
              ))}
            </Panel>
          )}
          {tab === "invitations" && <Invitations data={data} reload={load} />}
          {tab === "support" && (
            <SupportCenter
              data={data}
              selected={selected}
              setSelected={setSelected}
              reload={load}
              presence={presence}
              setPresence={setPresence}
            />
          )}
          {tab === "sales" && <SalesInquiries data={data} reload={load} />}
          {tab === "specialists" && (
            <Specialists data={data} users={data.users || []} reload={load} />
          )}
          {tab === "audit" && (
            <Panel title="Administrative audit history">
              {(data.events || []).map((x: any) => (
                <Row
                  key={x.id}
                  primary={String(x.action).replaceAll("_", " ")}
                  secondary={new Date(x.createdAt).toLocaleString()}
                />
              ))}
            </Panel>
          )}
          {tab === "health" && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card
                label="Database"
                value={data.health?.database || "Unknown"}
              />
              <Card
                label="Transactional email"
                value={
                  data.health?.emailConfigured ? "Configured" : "Not configured"
                }
              />
              <Card
                label="Support worker"
                value={
                  data.health?.supportWorkerEnabled ? "Enabled" : "Disabled"
                }
              />
            </div>
          )}
          {tab === "settings" && <SupportSettings data={data} reload={load} />}
        </main>
      </div>
      <SupportWidget organizationId={session.activeOrganizationId} />
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <section className="mt-5 rounded-2xl border border-[#dcd5c8] bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3">
        {children || <p className="text-sm text-[#687671]">No records yet.</p>}
      </div>
    </section>
  );
}
function Row({ primary, secondary }: any) {
  return (
    <div className="border-b py-3 last:border-0">
      <b className="capitalize">{primary}</b>
      <div className="text-sm text-[#687671]">{secondary}</div>
    </div>
  );
}
function Organizations({ data, reload }: any) {
  const [name, setName] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api("/admin/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setName("");
    await reload();
  }
  return (
    <>
      <form
        onSubmit={submit}
        className="flex gap-2 rounded-2xl border bg-white p-4"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="New organization name"
          className="flex-1 rounded-lg border px-3"
        />
        <Button className="bg-[#184f46]">Create organization</Button>
      </form>
      <Panel title="Organizations">
        {(data.organizations || []).map((x: any) => (
          <div key={x.id} className="flex justify-between border-b py-3">
            <div>
              <b>{x.name}</b>
              <div className="text-sm text-[#687671]">
                {x.hotelCount} hotels · {x.administratorCount} above-property
                admins · {x.status}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await api(`/admin/organizations/${x.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    status: x.status === "active" ? "inactive" : "active",
                  }),
                });
                await reload();
              }}
            >
              {x.status === "active" ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ))}
      </Panel>
    </>
  );
}
function Invitations({ data, reload }: any) {
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [resendingId, setResendingId] = useState<string | null>(null);
  return (
    <Panel title="Invitation history">
      {message && (
        <div
          className={`fixed bottom-5 left-1/2 z-[60] flex w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 items-start justify-between gap-4 rounded-xl border p-4 text-sm shadow-2xl ${
            messageTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}
      {(data.invitations || []).map((x: any) => {
        const pending = !x.invitation.acceptedAt && !x.invitation.revokedAt;
        return (
          <div
            key={x.invitation.id}
            className="flex items-center justify-between gap-3 border-b py-3"
          >
            <div>
              <b>{x.invitation.email}</b>
              <div className="text-sm text-[#687671]">
                {x.organization.name} · {x.invitation.role} ·{" "}
                {x.invitation.acceptedAt
                  ? "accepted"
                  : x.invitation.revokedAt
                    ? "revoked"
                    : new Date(x.invitation.expiresAt) < new Date()
                      ? "expired"
                      : "pending"}
              </div>
            </div>
            {!x.invitation.acceptedAt && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resendingId === x.invitation.id}
                  onClick={async () => {
                    setMessage("");
                    setResendingId(x.invitation.id);
                    try {
                      const result = await api(
                        `/admin/invitations/${x.invitation.id}/resend`,
                        { method: "POST" },
                      );
                      const accepted =
                        result.emailStatus === "accepted" || result.delivered;
                      setMessageTone(accepted ? "success" : "error");
                      setMessage(
                        accepted
                          ? "The renewed invitation was accepted by the email provider. Inbox delivery may still be pending."
                          : "The invitation was renewed, but the email provider did not accept it. Check the delivery logs before retrying.",
                      );
                      await reload();
                    } catch (error) {
                      setMessageTone("error");
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to resend the invitation.",
                      );
                    } finally {
                      setResendingId(null);
                    }
                  }}
                >
                  {resendingId === x.invitation.id ? "Resending…" : "Resend"}
                </Button>
                {pending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await api(
                        `/admin/invitations/${x.invitation.id}/revoke`,
                        { method: "POST" },
                      );
                      await reload();
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Panel>
  );
}
function SupportCenter({
  data,
  selected,
  setSelected,
  reload,
  presence,
  setPresence,
}: any) {
  const [detail, setDetail] = useState<any>(null),
    [body, setBody] = useState("");
  useEffect(() => {
    if (selected) api(`/admin/support/${selected}`).then(setDetail);
  }, [selected]);
  if (detail)
    return (
      <Panel
        title={`${detail.conversation.reference} · ${detail.conversation.status}`}
      >
        <button
          className="mb-3 text-sm underline"
          onClick={() => {
            setSelected(null);
            setDetail(null);
          }}
        >
          ← Queue
        </button>
        <div className="grid gap-2">
          {detail.messages.map((x: any) => (
            <div
              key={x.message.id}
              className={`max-w-2xl rounded-xl p-3 ${x.message.senderType === "support" ? "ml-auto bg-[#184f46] text-white" : "bg-[#f2efe8]"}`}
            >
              <div>{x.message.body}</div>
              <small>
                {x.sender.displayName} ·{" "}
                {new Date(x.message.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await api(`/admin/support/${selected}/messages`, {
              method: "POST",
              body: JSON.stringify({ body }),
            });
            setBody("");
            setDetail(await api(`/admin/support/${selected}`));
          }}
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className="flex-1 rounded-lg border px-3"
          />
          <Button className="bg-[#184f46]">Reply</Button>
        </form>
        <div className="mt-3 flex gap-2">
          {["pending", "resolved", "active"].map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              onClick={async () => {
                await api(`/admin/support/${selected}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status }),
                });
                setDetail(await api(`/admin/support/${selected}`));
              }}
            >
              {status}
            </Button>
          ))}
        </div>
      </Panel>
    );
  return (
    <>
      <div className="mb-3 flex justify-end gap-2">
        <span className="self-center text-xs text-[#687671]">
          Presence: {presence}
        </span>
        <Button variant="outline" size="sm" onClick={() => setPresence("away")}>
          Set Away
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPresence("online")}
        >
          Set Online
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Card label="Waiting" value={data.metrics?.waiting} />
        <Card label="Active" value={data.metrics?.active} />
        <Card label="Unanswered" value={data.metrics?.unanswered} />
        <Card label="Escalated" value={data.metrics?.escalated} />
        <Card label="Open tickets" value={data.metrics?.openTickets} />
        <Card
          label="Avg. response"
          value={
            data.metrics?.averageFirstResponseSeconds == null
              ? "—"
              : `${data.metrics.averageFirstResponseSeconds}s`
          }
        />
      </div>
      <Panel title="Support inbox">
        {(data.conversations || []).map((x: any) => (
          <button
            key={x.conversation.id}
            onClick={() => setSelected(x.conversation.id)}
            className="block w-full border-b py-3 text-left"
          >
            <b>
              {x.conversation.reference} · {x.requester.displayName}
            </b>
            <div className="text-sm text-[#687671]">
              {x.organization.name}
              {x.hotel ? ` · ${x.hotel.name}` : ""} ·{" "}
              {x.conversation.type.replace("_", " ")} · {x.conversation.status}{" "}
              · {new Date(x.conversation.lastActivityAt).toLocaleString()}
            </div>
          </button>
        ))}
      </Panel>
    </>
  );
}
function SalesInquiries({ data, reload }: any) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const inquiries = data.inquiries || [];
  const selected = inquiries.find((item: any) => item.id === selectedId);

  async function updateInquiry(values: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/admin/sales-inquiries/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      {!data.salesRecipientConfigured && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Sales inquiries are being stored, but email notifications require the server-only HOTEL_OPS_SALES_EMAIL setting.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        {(["new", "contacted", "qualified", "closed"] as const).map((status) => (
          <Card key={status} label={status[0].toUpperCase() + status.slice(1)} value={inquiries.filter((item: any) => item.status === status).length} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <Panel title="INNTRIX sales inquiry queue">
          {inquiries.length === 0 && <p className="py-5 text-sm text-[#6a7772]">No sales inquiries yet.</p>}
          {inquiries.map((item: any) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedId(item.id);
                setNotes(item.internalNotes || "");
              }}
              className={`block w-full border-b px-2 py-3 text-left last:border-0 ${selectedId === item.id ? "bg-[#eef3f0]" : "hover:bg-[#f7f5ef]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <b>{item.fullName}</b>
                <span className="rounded-full bg-[#ebe5d8] px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{item.status}</span>
              </div>
              <div className="mt-1 text-sm text-[#687671]">{item.companyName} · {new Date(item.createdAt).toLocaleString()}</div>
            </button>
          ))}
        </Panel>
        <Panel title={selected ? `${selected.reference} · ${selected.status}` : "Inquiry details"}>
          {!selected ? (
            <p className="py-5 text-sm text-[#6a7772]">Select an inquiry to review contact details and follow-up status.</p>
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-2 rounded-xl bg-[#f5f2eb] p-4 text-sm">
                <div><b>Name:</b> {selected.fullName}</div>
                <div><b>Business email:</b> <a className="text-[#176357] underline" href={`mailto:${selected.email}`}>{selected.email}</a></div>
                <div><b>Hotel / company:</b> {selected.companyName}</div>
                <div><b>Properties:</b> {selected.propertyCount || "Not provided"}</div>
                <div><b>Received:</b> {new Date(selected.createdAt).toLocaleString()}</div>
                <div><b>Sales notification:</b> {selected.salesNotifiedAt ? "Sent" : "Not sent"}</div>
                <div><b>Prospect confirmation:</b> {selected.confirmationSentAt ? "Sent" : "Not sent"}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#7a6a4f]">Inquiry</div>
                <p className="whitespace-pre-wrap rounded-xl border bg-white p-4 text-sm leading-6">{selected.message}</p>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                Follow-up status
                <select value={selected.status} disabled={saving} onChange={(event) => void updateInquiry({ status: event.target.value })} className="w-fit rounded-lg border bg-white px-3 py-2">
                  {(["new", "contacted", "qualified", "closed"] as const).map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
                </select>
              </label>
              <form
                className="grid gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await updateInquiry({ internalNotes: notes || null });
                }}
              >
                <label htmlFor="sales-internal-notes" className="text-sm font-medium">Internal follow-up notes</label>
                <textarea id="sales-internal-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} rows={4} className="rounded-lg border bg-white p-3 text-sm" />
                <Button disabled={saving} className="w-fit bg-[#184f46]">{saving ? "Saving…" : "Save notes"}</Button>
              </form>
            </div>
          )}
        </Panel>
      </div>
      <p className="text-xs leading-5 text-[#77837f]">Sales inquiry contact information is restricted to Platform Owners and Support Administrators and expires after 24 months.</p>
    </div>
  );
}
function Specialists({ data, reload }: any) {
  const [email, setEmail] = useState(""),
    [supportRole, setSupportRole] = useState("support_specialist"),
    [message, setMessage] = useState("");
  async function invite(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await api("/admin/support-invitations", {
        method: "POST",
        body: JSON.stringify({ email, supportRole }),
      });
      setMessage(
        result.invitation.delivered
          ? "Invitation sent."
          : "Invitation created; email delivery needs attention.",
      );
      setEmail("");
      await reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to send invitation",
      );
    }
  }
  return (
    <>
      <form
        className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[1fr_220px_auto]"
        onSubmit={invite}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Support team email"
          className="rounded-lg border px-3 py-2"
        />
        <select
          value={supportRole}
          onChange={(e) => setSupportRole(e.target.value)}
          className="rounded-lg border px-3"
        >
          <option value="support_specialist">Support Specialist</option>
          <option value="support_administrator">Support Administrator</option>
        </select>
        <Button className="bg-[#184f46]">Send invitation</Button>
        {message && <p className="text-sm md:col-span-3">{message}</p>}
      </form>
      <Panel title="Pending invitations">
        {(data.invitations || []).map((x: any) => (
          <div
            key={x.id}
            className="flex items-center justify-between border-b py-3"
          >
            <div>
              <b>{x.email}</b>
              <div className="text-sm text-[#687671]">
                {x.supportRole.replaceAll("_", " ")} · expires{" "}
                {new Date(x.expiresAt).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await api(`/admin/support-invitations/${x.id}/resend`, {
                    method: "POST",
                  });
                  await reload();
                }}
              >
                Resend
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await api(`/admin/support-invitations/${x.id}/revoke`, {
                    method: "POST",
                  });
                  await reload();
                }}
              >
                Revoke
              </Button>
            </div>
          </div>
        ))}
      </Panel>
      <Panel title="Active support personnel">
        {(data.specialists || []).map((x: any) => (
          <div
            key={x.account.id}
            className="flex justify-between border-b py-3"
          >
            <div>
              <b>{x.account.displayName}</b>
              <div className="text-sm text-[#687671]">
                {x.account.email} ·{" "}
                {x.specialist.supportRole.replaceAll("_", " ")} ·{" "}
                {x.effectivePresence} ·{" "}
                {x.specialist.enabled ? "active" : "revoked"}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await api(`/admin/support-specialists/${x.account.id}`, {
                  method: "PUT",
                  body: JSON.stringify({
                    enabled: false,
                    supportRole: x.specialist.supportRole,
                    emailNotifications: x.specialist.emailNotifications,
                    escalationRecipient: x.specialist.escalationRecipient,
                  }),
                });
                await reload();
              }}
            >
              Revoke access
            </Button>
          </div>
        ))}
      </Panel>
    </>
  );
}
function SupportSettings({ data, reload }: any) {
  const [form, setForm] = useState<any>(data.settings || {});
  useEffect(() => setForm(data.settings || {}), [data]);
  return (
    <form
      className="grid gap-4 rounded-2xl border bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await api("/admin/support-settings", {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        await reload();
      }}
    >
      <p
        className={`rounded-lg p-3 text-sm ${data.emailOperational ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
      >
        {data.emailOperational
          ? "Brevo escalation delivery is configured."
          : "Brevo is not configured; escalation email is not operational."}
      </p>
      {[
        ["liveChatEnabled", "Enable Live Chat"],
        ["ticketsEnabled", "Enable Leave a Message"],
        ["escalationEmailsEnabled", "Enable escalation email"],
        ["secondaryEscalationEnabled", "Enable secondary escalation"],
      ].map(([key, label]) => (
        <label key={key} className="flex gap-2">
          <input
            type="checkbox"
            checked={Boolean(form[key])}
            onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <label>
        First-response threshold (seconds)
        <input
          type="number"
          min={30}
          max={3600}
          value={form.firstResponseSeconds || 120}
          onChange={(e) =>
            setForm({ ...form, firstResponseSeconds: Number(e.target.value) })
          }
          className="mt-1 block rounded-lg border px-3 py-2"
        />
      </label>
      <label>
        Availability message
        <textarea
          value={form.availabilityMessage || ""}
          onChange={(e) =>
            setForm({ ...form, availabilityMessage: e.target.value })
          }
          className="mt-1 block w-full rounded-lg border p-3"
        />
      </label>
      <Button className="w-fit bg-[#184f46]">Save settings</Button>
    </form>
  );
}
