"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { id: "services", label: "Services" },
  { id: "studio", label: "Studio" },
  { id: "stylists", label: "Stylists" },
  { id: "partners", label: "Partners" },
];

interface Me {
  name: string;
  email: string;
  wallet: number;
  role?: string;
  providerId?: string;
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === "/";

  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("services");

  const headerRef = useRef<HTMLElement>(null);
  const clickLockUntil = useRef(0);

  const loadMe = useCallback(async (): Promise<Me | null> => {
    try {
      const r = await api("/auth/me");
      const d = await r.json();
      setMe(d.user ?? null);
      return d.user ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setUserOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setUserOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  useEffect(() => {
    if (!isLanding) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < clickLockUntil.current) return;
        const hit = entries.filter((e) => e.isIntersecting).pop();
        if (hit) setActiveSection(hit.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLanding]);

  const handleBook = (e: ReactMouseEvent) => {
    if (!me) {
      e.preventDefault();
      router.push("/login");
    } else {
      setMenuOpen(false);
    }
  };

  const handleNavClick = (id: string) => {
    if (isLanding) {
      setActiveSection(id);
      clickLockUntil.current = Date.now() + 900;
    }
    setMenuOpen(false);
  };

  const logout = async () => {
    try {
      await api("/auth/me", { method: "DELETE" });
    } catch {}
    window.location.href = "/";
  };

  const firstName = me ? (me.name || me.email).split(" ")[0] : "";

  const accountLinks = (done: () => void) => (
    <>
      <Link className="menu-item" href="/account" onClick={done}>
        My account
      </Link>
      {me?.role === "provider" && me.providerId && (
        <Link className="menu-item" href="/provider" onClick={done}>
          Provider dashboard
        </Link>
      )}
      {me?.role === "admin" && (
        <Link className="menu-item" href="/admin" onClick={done}>
          Admin panel
        </Link>
      )}
      <button type="button" className="menu-item" onClick={logout}>
        Log out
      </button>
    </>
  );

  return (
    <>
      <header ref={headerRef} className={`header ${scrolled ? "scrolled" : ""}`}>
        <nav className="fnav" aria-label="Main">
          <Link className="logo" href="/">
            Shringar<span className="logo-dot" aria-hidden="true" />
          </Link>

          <ul className="nav-links">
            {NAV_ITEMS.map(({ id, label }) => {
              const active = isLanding && activeSection === id;
              return (
                <li key={id}>
                  <Link
                    href={isLanding ? `#${id}` : `/#${id}`}
                    className={`nav-link${active ? " active" : ""}`}
                    aria-current={active ? "location" : undefined}
                    onClick={() => handleNavClick(id)}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="nav-actions">
            <div className="nav-cta">
              {me ? (
                <div className="user-menu">
                  <button
                    type="button"
                    className="btn btn-outline"
                    aria-haspopup="true"
                    aria-expanded={userOpen}
                    onClick={() => setUserOpen((v) => !v)}
                  >
                    {firstName}
                  </button>
                  {userOpen && (
                    <div className="user-dropdown">{accountLinks(() => setUserOpen(false))}</div>
                  )}
                </div>
              ) : (
                <button type="button" className="btn btn-outline" onClick={() => router.push("/login")}>
                  Log in
                </button>
              )}
              <Link className="btn btn-primary" href="/booking" onClick={handleBook}>
                Book now
              </Link>
            </div>

            <button
              type="button"
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobileNav"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={`hamburger${menuOpen ? " open" : ""}`} aria-hidden="true">
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </span>
            </button>
          </div>
        </nav>

        <div
          id="mobileNav"
          className={`mobile-nav${menuOpen ? " open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <ul className="mobile-nav-links">
            {NAV_ITEMS.map(({ id, label }) => (
              <li key={id}>
                <Link
                  href={isLanding ? `#${id}` : `/#${id}`}
                  className={`mobile-nav-link${isLanding && activeSection === id ? " active" : ""}`}
                  onClick={() => handleNavClick(id)}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mobile-nav-actions">
            {me ? (
              accountLinks(() => setMenuOpen(false))
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => router.push("/login")}>
                Log in / Sign up
              </button>
            )}
            <Link className="btn btn-primary" href="/booking" onClick={handleBook}>
              Book now
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}