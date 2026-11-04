"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Config {
  firstBookingDiscountPct: number;
  referralCredit: number;
}

export default function NameYourPrice() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    api("/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setConfig(d))
      .catch(() => {});
  }, []);

  // Perks mirror the live platform settings, so the page never promises something the server won't give.
  const perks: string[] = [];
  if (config && config.firstBookingDiscountPct > 0) perks.push(`First booking: ${config.firstBookingDiscountPct}% off`);
  if (config && config.referralCredit > 0) perks.push(`Refer a friend: NPR ${config.referralCredit} credit`);

  return (
    <section id="price">
      <div className="band">
        <div>
          <h2>Name your price</h2>
          <p>Set what you want to pay. Stylists nearby see the request and reply in minutes. You choose the offer you like.</p>
        </div>
        {perks.length > 0 && (
          <ul>
            {perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
