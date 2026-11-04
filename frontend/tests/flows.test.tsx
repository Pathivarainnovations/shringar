import { describe, it, expect, beforeAll } from "vitest";
import { screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Session, adminSession, signUp, uniq, nav, renderPage } from "./helpers";

interface BookingResponse { booking: { id: string; status: string; payStatus: string; reviewed?: boolean } }
interface ApplicationsResponse { applications: Array<{ id: string; name: string }> }
interface ProviderProfileResponse { provider: { id: string } }
interface ServicesResponse { services: Array<{ name: string; price: number }> }
interface MessagesResponse { messages: Array<{ body: string }> }

import BookingPage from "@/app/(app)/booking/page";
import CheckoutPage from "@/app/(app)/checkout/[id]/page";
import ProviderRequestsPage from "@/app/(app)/provider/requests/page";
import ProviderServicesPage from "@/app/(app)/provider/services/page";
import TrackClient from "@/app/(app)/track/[id]/TrackClient";
import AdminHome from "@/app/(app)/admin/page";
import AdminCatalogue from "@/app/(app)/admin/catalogue/page";
import MessagesView from "@/components/MessagesView";
import ClientBookingsPage from "@/app/(app)/client/bookings/page";

let admin: Session, cust: Session, prov: Session, provId = "", bookingId = "";

beforeAll(async () => {
  admin = await adminSession();
  cust = await signUp(uniq("c"), "Cara Customer");
  prov = await signUp(uniq("p"), "Pema Provider");
  await prov.call("POST", "/partner/apply", { name: "Pema Beauty", phone: "9841000009", type: "freelance", service: "Haircut", area: "Thamel", idNote: "CTZ 99" });
  const apps = (await admin.call("GET", "/admin/applications")).data as ApplicationsResponse;
  await admin.call("PATCH", `/admin/applications/${apps.applications.find((a) => a.name === "Pema Beauty")?.id}`, { status: "approved" });
  await prov.call("PUT", "/provider/services/1", { price: 1000 });
  provId = ((await prov.call("GET", "/provider/profile")).data as ProviderProfileResponse).provider.id;
});
const as = (s: Session) => { cleanup(); s.install(); nav.push.mockClear(); };

describe("customer: booking → checkout → provider handles it → tracking", () => {
  it("booking page: chooses a provider, sees THEIR price, and submits", async () => {
    as(cust); const u = userEvent.setup();
    renderPage(<BookingPage />);
    await screen.findByText("Haircut and styling");
    await u.selectOptions(await screen.findByLabelText("Provider"), provId);
    await waitFor(() => expect(screen.getByText("NPR 1,000")).toBeTruthy());                  // provider's own price, not the 900 suggestion
    expect(screen.queryByText("Facial")).toBeNull();                                           // services the provider does not offer are hidden
    await u.click(screen.getByText("Haircut and styling"));
    await waitFor(() => expect(screen.getByText("Total").parentElement!.textContent).toMatch(/NPR 1,0\d\d|NPR 1,\d{3}/));
    await u.type(screen.getByLabelText("Address"), "House 7, Thamel");
    await u.selectOptions(screen.getByLabelText("Area"), "Thamel");
    await u.click(screen.getByRole("button", { name: "Send Booking Request" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const to = nav.push.mock.calls[0][0] as string;
    expect(to).toMatch(/^\/checkout\/SHR-/); bookingId = to.split("/").pop()!;
  });

  it("checkout page: before acceptance it says waiting; no card/eSewa options exist", async () => {
    as(cust); nav.params = { id: bookingId };
    renderPage(<CheckoutPage />);
    expect(await screen.findByText("Waiting for a provider")).toBeTruthy();
    expect(screen.queryByText(/esewa|khalti|card/i)).toBeNull();
  });

  it("provider requests page: shows the request, accepts it, then runs the trip", async () => {
    as(prov); const u = userEvent.setup();
    renderPage(<ProviderRequestsPage />);
    expect(await screen.findByText(/Haircut and styling|Service 1/)).toBeTruthy();
    expect(screen.getByText(/Cara/)).toBeTruthy();                                              // first name only
    await u.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(async () => expect(((await cust.call("GET", `/bookings/${bookingId}`)).data as BookingResponse).booking.status).toBe("accepted"));
    await u.click(await screen.findByRole("tab", { name: /Active/ }));
    await u.click(await screen.findByRole("button", { name: "Start trip" }));
    await waitFor(async () => expect(((await cust.call("GET", `/bookings/${bookingId}`)).data as BookingResponse).booking.status).toBe("on_the_way"));
  });

  it("customer tracking page: live status, and the honest waiting message until a position arrives", async () => {
    as(cust); nav.params = { id: bookingId };
    renderPage(<TrackClient />);
    expect(await screen.findByRole("heading", { name: "Your provider is on the way" })).toBeTruthy();
    expect(await screen.findByText("Waiting for the provider's location...")).toBeTruthy();
    expect(screen.queryByTestId("map")).toBeNull();
    await prov.call("POST", "/tracking/location", { bookingId, lat: 27.7, lng: 85.3, etaMinutes: 9 });
    cleanup(); renderPage(<TrackClient />);
    expect(await screen.findByTestId("map", {}, { timeout: 8000 })).toBeTruthy();
    expect(await screen.findByText(/About 9 min away/)).toBeTruthy();
    expect(document.querySelectorAll("h1").length).toBe(1);
  });

  it("checkout (after acceptance): choose cash → confirmed → goes to tracking", async () => {
    as(cust); const u = userEvent.setup(); nav.params = { id: bookingId };
    renderPage(<CheckoutPage />);
    await u.click(await screen.findByRole("button", { name: "Confirm cash payment" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(`/track/${bookingId}`));
    expect(((await cust.call("GET", `/bookings/${bookingId}`)).data as BookingResponse).booking.payStatus).toBe("cash_due");
  });

  it("provider finishes the booking and records cash; customer then sees the review form", async () => {
for (const s of ["arrived", "in_progress", "done"]) await prov.call("POST", `/bookings/${bookingId}/status`, { status: s });
  as(prov); const u = userEvent.setup();
  renderPage(<ProviderRequestsPage />);
  await u.click(await screen.findByRole("tab", { name: /Completed/ }));
  await u.click(await screen.findByRole("button", { name: "Cash received" }));
  await waitFor(async () => expect(((await cust.call("GET", `/bookings/${bookingId}`)).data as BookingResponse).booking.payStatus).toBe("paid"));
  as(cust); nav.params = { id: bookingId }; renderPage(<TrackClient />);
  expect(await screen.findByRole("heading", { name: "Service completed" })).toBeTruthy();
  await u.click(await screen.findByRole("radio", { name: "5 stars" }));
  await u.click(screen.getByRole("button", { name: "Submit review" }));
  await waitFor(async () => expect(((await cust.call("GET", `/bookings/${bookingId}`)).data as BookingResponse).booking.reviewed).toBe(true));
  });

  it("customer bookings list: shows the finished booking under Completed with a review/paid state", async () => {
    as(cust); const u = userEvent.setup();
    renderPage(<ClientBookingsPage />);
    await u.click(await screen.findByRole("tab", { name: "Completed" }));
    expect(await screen.findByText("Pema Beauty", { exact: false })).toBeTruthy();
  });
});

describe("provider + admin pages", () => {
  it("provider services page: saving a price persists", async () => {
    as(prov); const u = userEvent.setup();
    renderPage(<ProviderServicesPage />);
    const box = await screen.findByLabelText("Your price for Facial");
    await u.type(box, "1750");
    await u.click(within(box.closest("tr")!).getByRole("button", { name: "Save" }));
    await waitFor(async () => expect(((await prov.call("GET", "/provider/services")).data as ServicesResponse).services.find((s) => s.name === "Facial")?.price).toBe(1750));
  });

  it("messages: customer sends, provider sees it", async () => {
    as(cust); const u = userEvent.setup();
    renderPage(<MessagesView emptyHint="none" />);
    await u.click(await screen.findByRole("button", { name: /Pema Beauty/ }));
    await u.type(await screen.findByLabelText("Message"), "Thank you!");
    await u.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(async () => expect(((await prov.call("GET", `/bookings/${bookingId}/messages`)).data as MessagesResponse).messages.some((m) => m.body === "Thank you!")).toBe(true));
  });

  it("admin dashboard: real totals with role breakdown and the commission from the completed booking", async () => {
    as(admin);
    renderPage(<AdminHome />);
    expect(await screen.findByText("Total users")).toBeTruthy();
    const card = screen.getByText("Total users").closest("div")!.parentElement!;
    expect(card.textContent).toMatch(/\d+ customers • 1 providers • 1 admins/);
    const text = document.body.textContent!;
    expect(text).toMatch(/Completed bookings1(?!\d)/);
    expect(text).toMatch(/Platform commissionNPR 120(?!\d)/);   // 15% of (1,000 - 20% first-booking discount) = 120; travel fee excluded
  });

  it("admin catalogue: adding an area works and shows up", async () => {
    as(admin); const u = userEvent.setup();
    renderPage(<AdminCatalogue />);
    await screen.findByText("Jawalakhel", { exact: false });
    await u.type(screen.getByLabelText("Area name"), "Boudha");
    await u.type(screen.getByLabelText("City"), "Kathmandu");
    await u.click(screen.getByRole("button", { name: "Add area" }));
    expect(await screen.findByText("Boudha", { exact: false })).toBeTruthy();
  });
});
