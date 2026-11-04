import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn(); const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams("redirect=/client"),
  usePathname: () => "/login",
}));
import LoginPage from "@/app/(marketing)/login/page";

const devCodeFromScreen = async () => {
  const el = await screen.findByText(/Dev code \(development only\): \d{6}/);
  return el.textContent!.match(/(\d{6})/)![1];
};
beforeEach(() => { cleanup(); push.mockClear(); replace.mockClear(); });
const uniq = () => `ui${Date.now()}${Math.floor(Math.random()*1e4)}@example.com`;

describe("login page against the real backend", () => {
  it("code login: asks for email, sends a code, accepts the 6-digit code and redirects", async () => {
    const u = userEvent.setup(); const email = uniq();
    render(<LoginPage />);
    await u.click(await screen.findByText("Sign in with a code instead"));
    expect(await screen.findByRole("heading", { name: "Sign in with a code" })).toBeTruthy();
    const emailBox = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailBox.readOnly).toBe(false);                       // was a read-only empty box before
    await u.type(emailBox, email);
    await u.click(screen.getByRole("button", { name: "Send code" }));
    const code = await devCodeFromScreen();
    const codeBox = await screen.findByLabelText("Verification code");
    await u.type(codeBox, code);
    const submit = screen.getByRole("button", { name: "Sign in" });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));   // 6 digits enable it
    await u.click(submit);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/client"));
  });

  it("code login: wrong code shows an error and does not redirect", async () => {
    const u = userEvent.setup(); const email = uniq();
    render(<LoginPage />);
    await u.click(await screen.findByText("Sign in with a code instead"));
    await u.type(screen.getByLabelText("Email"), email);
    await u.click(screen.getByRole("button", { name: "Send code" }));
    const real = await devCodeFromScreen();
    await u.type(await screen.findByLabelText("Verification code"), real === "000000" ? "111111" : "000000");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong code")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("5-digit code keeps the button disabled", async () => {
    const u = userEvent.setup();
    render(<LoginPage />);
    await u.click(await screen.findByText("Sign in with a code instead"));
    await u.type(screen.getByLabelText("Email"), uniq());
    await u.click(screen.getByRole("button", { name: "Send code" }));
    await devCodeFromScreen();
    await u.type(await screen.findByLabelText("Verification code"), "12345");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("signup with referral field: email code step accepts 6 digits and creates the account", async () => {
    const u = userEvent.setup(); const email = uniq();
    render(<LoginPage />);
    await u.click(await screen.findByRole("button", { name: /sign up/i }));
    await u.type(await screen.findByLabelText("Full name"), "Test Person");
    await u.type(screen.getByLabelText("Email"), email);
    expect(screen.getByLabelText("Referral code (optional)")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /send code|sign up|continue/i }));
    const code = await devCodeFromScreen();
    await u.type(await screen.findByLabelText("Verification code"), code);
    await u.type(screen.getByLabelText("Password"), "password123");
    const btn = screen.getAllByRole("button").find((b) => /sign up|create|verify/i.test(b.textContent || "") && !(b as HTMLButtonElement).disabled);
    await waitFor(() => expect(btn).toBeTruthy());
    await u.click(btn!);
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("password login: wrong password shows the server's error", async () => {
    const u = userEvent.setup();
    render(<LoginPage />);
    await u.type(await screen.findByLabelText("Email"), "nobody@example.com");
    await u.type(screen.getByLabelText("Password"), "wrongpass1");
    await u.click(screen.getAllByRole("button", { name: "Sign in" })[0]);
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
  });
});
