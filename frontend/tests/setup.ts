import { vi } from "vitest";
import React from "react";
import { nav } from "./helpers";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useParams: () => nav.params,
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => React.createElement("a", { href, ...rest }, children) }));
vi.mock("@/components/maps/LiveMap", () => ({ default: ({ markers }: { markers: unknown[] }) => React.createElement("div", { "data-testid": "map" }, `map with ${markers.length} marker(s)`) }));
window.confirm = () => true;
window.alert = () => {};
Element.prototype.scrollIntoView = () => {};

// jsdom's WebSocket cannot talk to Node's event system. The tracking page falls back to polling, which is what
// the tests exercise; the WebSocket push itself is covered by the backend checks.
class NoopWebSocket {
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  send() {}
  close() {}
}
// @ts-expect-error replacing the jsdom implementation on purpose
globalThis.WebSocket = NoopWebSocket;
