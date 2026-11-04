"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ServiceCategory } from "@/lib/types";
import { useT } from "./i18n";

export default function Services() {
  const { t } = useT();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    api("/categories")
      .then((r) => r.json())
      .then((d) => setCategories(Array.isArray(d.categories) ? d.categories : []))
      .catch(() => {});
  }, []);

  if (categories.length === 0) return null; // nothing to show until an admin sets up categories
  return (
    <section id="services">
      <h2>{t("services.title")}</h2>
      <p className="sub">{t("services.sub")}</p>
      <div className="cats">
        {categories.map((c) => (
          <div className="cat" key={c.name}>
            <div className="ph">
              <img
                src={c.image}
                alt={c.name}
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div className="image-fallback" aria-hidden="true" style={{ display: "none", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontSize: "3rem" }}>
                🖼️
              </div>
            </div>
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}