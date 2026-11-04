"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, Skeleton, useToast } from "@/components/app-shell";
import type { Service, ServiceCategory } from "@/lib/types";

interface AdminPackage {
  id: string;
  name: string;
  service_ids: string;
  discount_pct: number;
  is_active: number;
}

interface AdminArea {
  id: number;
  name: string;
  city: string;
  active: boolean;
}

const json = { "Content-Type": "application/json" };

export default function AdminCataloguePage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [areas, setAreas] = useState<AdminArea[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [pkg, setPkg] = useState<{ name: string; ids: number[] }>({ name: "", ids: [] });

  const [svc, setSvc] = useState({ name: "", minutes: "", price: "" });
  const [cat, setCat] = useState({ name: "", image: "" });
  const [area, setArea] = useState({ name: "", city: "" });

  const load = useCallback(async () => {
    try {
      const [s, c, a, p] = await Promise.all([
        api("/admin/services").then((r) => r.json()),
        api("/admin/categories").then((r) => r.json()),
        api("/admin/areas").then((r) => r.json()),
        api("/admin/packages").then((r) => r.json()),
      ]);
      setPackages(p.packages ?? []);
      setServices(s.services ?? []);
      setCategories(c.categories ?? []);
      setAreas(a.areas ?? []);
    } catch {
      showToast({ type: "error", title: "Could not load the catalogue" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // One helper for every write: shows the server's error message, reloads on success.
  async function call(path: string, method: string, body?: unknown, okMessage?: string): Promise<boolean> {
    const res = await api(path, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast({ type: "error", title: d.error || "Something went wrong" });
      return false;
    }
    if (okMessage) showToast({ type: "success", title: okMessage });
    await load();
    return true;
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/admin/services", "POST", { name: svc.name, minutes: Number(svc.minutes), price: Number(svc.price) }, "Service added")) {
      setSvc({ name: "", minutes: "", price: "" });
    }
  }
  async function editService(s: Service) {
    const price = window.prompt(`New suggested price for "${s.name}" (NPR)`, String(s.price));
    if (price === null) return;
    await call(`/admin/services/${s.id}`, "PATCH", { price: Number(price) }, "Service updated");
  }
  async function removeService(s: Service) {
    if (!window.confirm(`Delete "${s.name}"? Existing bookings keep their details.`)) return;
    await call(`/admin/services/${s.id}`, "DELETE", undefined, "Service deleted");
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/admin/categories", "POST", cat, "Category added")) setCat({ name: "", image: "" });
  }
  async function removeCategory(c: ServiceCategory) {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    await call(`/admin/categories/${encodeURIComponent(c.name)}`, "DELETE", undefined, "Category deleted");
  }

  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/admin/areas", "POST", area, "Area added")) setArea({ name: "", city: "" });
  }
  const toggleArea = (a: AdminArea) => call(`/admin/areas/${a.id}`, "PATCH", { active: !a.active });
  async function removeArea(a: AdminArea) {
    if (!window.confirm(`Delete area "${a.name}"? Providers already using it keep their text.`)) return;
    await call(`/admin/areas/${a.id}`, "DELETE", undefined, "Area deleted");
  }

  async function addPackage(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/admin/packages", "POST", { name: pkg.name, serviceIds: pkg.ids }, "Package added")) setPkg({ name: "", ids: [] });
  }
  const togglePackage = (p: AdminPackage) => call(`/admin/packages/${p.id}`, "PATCH", { isActive: !p.is_active });
  async function removePackage(p: AdminPackage) {
    if (!window.confirm(`Delete package "${p.name}"?`)) return;
    await call(`/admin/packages/${p.id}`, "DELETE", undefined, "Package deleted");
  }

  if (loading) {
    return (
      <div>
        <h1 className="h1">Catalogue</h1>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Catalogue</h1>
      <p className="sub">Services, categories and service areas. Providers set their own prices on top of these.</p>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>Services</h3>
        {services.length === 0 ? (
          <EmptyState title="No services yet" description="Add the first service below, or run the reference-data script (see README)." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr><th align="left">Service</th><th align="left">Minutes</th><th align="left">Suggested price</th><th /></tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.minutes}</td>
                    <td>{formatNpr(s.price)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-outline btn-sm" onClick={() => editService(s)}>Edit price</button>{" "}
                      <button className="btn btn-outline btn-sm" onClick={() => removeService(s)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={addService} className="row" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
          <input aria-label="Service name" placeholder="Service name" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} required maxLength={80} />
          <input aria-label="Minutes" placeholder="Minutes" inputMode="numeric" value={svc.minutes} onChange={(e) => setSvc({ ...svc, minutes: e.target.value.replace(/\D/g, "") })} required style={{ width: 100 }} />
          <input aria-label="Suggested price" placeholder="Price (NPR)" inputMode="numeric" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value.replace(/\D/g, "") })} required style={{ width: 130 }} />
          <button className="btn btn-primary" type="submit">Add service</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Categories (landing page tiles)</h3>
        {categories.length === 0 ? (
          <EmptyState title="No categories yet" description="Categories appear as tiles on the landing page." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {categories.map((c) => (
              <li key={c.name} className="r" style={{ justifyContent: "space-between", padding: "8px 0" }}>
                <span><b>{c.name}</b> <small className="mut">{c.image}</small></span>
                <button className="btn btn-outline btn-sm" onClick={() => removeCategory(c)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addCategory} className="row" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
          <input aria-label="Category name" placeholder="Category name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} required maxLength={60} />
          <input aria-label="Image path" placeholder="/asset-4.jpg or https://…" value={cat.image} onChange={(e) => setCat({ ...cat, image: e.target.value })} required style={{ minWidth: 220 }} />
          <button className="btn btn-primary" type="submit">Add category</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Service areas</h3>
        {areas.length === 0 ? (
          <EmptyState title="No areas yet" description="Providers and customers choose from these areas." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {areas.map((a) => (
              <li key={a.id} className="r" style={{ justifyContent: "space-between", padding: "8px 0", opacity: a.active ? 1 : 0.55 }}>
                <span><b>{a.name}</b>, {a.city}{!a.active && " (hidden)"}</span>
                <span style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => toggleArea(a)}>{a.active ? "Hide" : "Show"}</button>{" "}
                  <button className="btn btn-outline btn-sm" onClick={() => removeArea(a)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addArea} className="row" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
          <input aria-label="Area name" placeholder="Area (e.g. Boudha)" value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} required maxLength={60} />
          <input aria-label="City" placeholder="City" value={area.city} onChange={(e) => setArea({ ...area, city: e.target.value })} required maxLength={60} />
          <button className="btn btn-primary" type="submit">Add area</button>
        </form>
      </section>
    
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Packages (quick-pick templates in the planner)</h3>
        {packages.length === 0 ? (
          <EmptyState title="No packages yet" description="A package pre-selects a set of services, e.g. a bridal day." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {packages.map((p) => (
              <li key={p.id} className="r" style={{ justifyContent: "space-between", padding: "8px 0", opacity: p.is_active ? 1 : 0.55 }}>
                <span><b>{p.name}</b> <small className="mut">{(JSON.parse(p.service_ids) as number[]).length} service(s){!p.is_active && " (hidden)"}</small></span>
                <span style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => togglePackage(p)}>{p.is_active ? "Hide" : "Show"}</button>{" "}
                  <button className="btn btn-outline btn-sm" onClick={() => removePackage(p)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addPackage} style={{ marginTop: 16 }}>
          <div className="fld"><label htmlFor="pk-name">Package name</label><input id="pk-name" value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} maxLength={80} required /></div>
          <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
            <legend className="mut">Services included</legend>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {services.map((s) => (
                <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={pkg.ids.includes(s.id)} onChange={(e) => setPkg({ ...pkg, ids: e.target.checked ? [...pkg.ids, s.id] : pkg.ids.filter((x) => x !== s.id) })} />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-primary" type="submit" disabled={!pkg.name.trim() || pkg.ids.length === 0}>Add package</button>
        </form>
      </section>
    </div>
  );
}
