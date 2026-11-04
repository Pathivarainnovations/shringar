"use client";

import { useEffect, useRef, useState } from "react";
import { send } from "@/lib/api";
import { useRoleApi } from "@/lib/hooks";
import { formatHour } from "@/lib/pricing";
import { EmptyState, Skeleton, StatusBadge, useToast } from "@/components/app-shell";
import { useSearchParams } from "next/navigation";

interface Conversation {
  bookingId: string;
  status: string;
  with: string;
  day: string;
  startHour: number;
  lastMessage: string | null;
  lastAt: string | null;
}
interface Message {
  id: string;
  mine: boolean;
  senderName: string;
  body: string;
  createdAt: string;
}

/** Booking chat for customers and providers. `emptyHint` explains how a conversation starts. */
export default function MessagesView({ emptyHint }: { emptyHint: string }) {
  const { showToast } = useToast();
  const list = useRoleApi<{ conversations: Conversation[] }>("/messages", ["customer", "provider"], 15000);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const thread = useRoleApi<{ messages: Message[]; canSend: boolean }>(selected ? `/bookings/${encodeURIComponent(selected)}/messages` : null, ["customer", "provider"], 5000);
  const bottom = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const preset = searchParams.get("booking");
    if (preset) setSelected(preset);
  }, [searchParams]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.data?.messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    setSending(true);
    const r = await send(`/bookings/${selected}/messages`, "POST", { body: draft });
    setSending(false);
    if (!r.ok) return showToast({ type: "error", title: r.error });
    setDraft("");
    thread.reload();
    list.reload();
  }

  const conversations = list.data?.conversations ?? [];
  const current = conversations.find((c) => c.bookingId === selected);

  return (
    <div>
      <h1 className="h1">Messages</h1>
      <p className="sub">Chat about a booking once a provider has accepted it.</p>
      {list.loading ? (
        <Skeleton variant="card" />
      ) : list.error ? (
        <EmptyState title="Could not load messages" description={list.error} action={{ label: "Try again", onClick: list.reload }} />
      ) : conversations.length === 0 ? (
        <EmptyState title="No conversations yet" description={emptyHint} />
      ) : (
        <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
          <section className="card" style={{ display: selected ? undefined : "block" }}>
            <h3>Bookings</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {conversations.map((c) => (
                <li key={c.bookingId}>
                  <button type="button" onClick={() => setSelected(c.bookingId)} aria-current={c.bookingId === selected} style={{ width: "100%", textAlign: "left", padding: 12, borderRadius: 8, border: "1px solid", borderColor: c.bookingId === selected ? "var(--gold)" : "var(--line)", background: "transparent", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <b>{c.with || "Customer"}</b>
                      <StatusBadge status={c.status} size="sm" />
                    </div>
                    <div className="mut" style={{ fontSize: "0.8125rem" }}>{c.bookingId} • {c.day} {formatHour(c.startHour)}</div>
                    {c.lastMessage && <div style={{ marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMessage}</div>}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            {!selected ? (
              <EmptyState title="Choose a booking" description="Pick a booking on the left to read and send messages." />
            ) : (
              <>
                <h3>{current ? `Chat with ${current.with || "customer"}` : `Booking ${selected}`}</h3>
                <div style={{ minHeight: 220, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }} aria-live="polite">
                  {thread.loading ? (
                    <Skeleton variant="text" count={3} />
                  ) : thread.error ? (
                    <p className="mut">{thread.error}</p>
                  ) : (thread.data?.messages.length ?? 0) === 0 ? (
                    <p className="mut">No messages yet. Say hello!</p>
                  ) : (
                    thread.data!.messages.map((m) => (
                      <div key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "80%", padding: "8px 12px", borderRadius: 12, background: m.mine ? "var(--gold)" : "var(--line)", color: m.mine ? "#0E3B2C" : "inherit", wordBreak: "break-word" }}>
                        {m.body}
                        <div style={{ fontSize: "0.6875rem", opacity: 0.7, marginTop: 2 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    ))
                  )}
                  <div ref={bottom} />
                </div>
                {thread.data?.canSend === false ? (
                  <p className="mut">This conversation is closed.</p>
                ) : (
                  <form onSubmit={submit} className="row" style={{ gap: 8, marginTop: 8 }}>
                    <input aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message" maxLength={1000} style={{ flex: 1 }} />
                    <button className="btn btn-primary" type="submit" disabled={sending || !draft.trim()}>Send</button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
