"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/pricing";
import { EmptyState, StatCard, useToast } from "@/components/app-shell";

interface Me {
  wallet: number;
  referralCode: string | null;
}

export default function ClientRewardsPage() {
  const { showToast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [referrals, setReferrals] = useState<number | null>(null);
  const [referralCredit, setReferralCredit] = useState<number | null>(null);

  useEffect(() => {
    api("/auth/me").then((r) => r.json()).then((d) => d.user && setMe({ wallet: d.user.wallet, referralCode: d.user.referralCode })).catch(() => {});
    api("/loyalty").then((r) => (r.ok ? r.json() : null)).then((d) => d && setPoints(d.loyalty?.points ?? 0)).catch(() => {});
    api("/referrals").then((r) => (r.ok ? r.json() : null)).then((d) => d && setReferrals((d.referrals ?? []).length)).catch(() => {});
    api("/config").then((r) => (r.ok ? r.json() : null)).then((d) => d && setReferralCredit(d.referralCredit)).catch(() => {});
  }, []);

  async function copyCode() {
    if (!me?.referralCode) return;
    try {
      await navigator.clipboard.writeText(me.referralCode);
      showToast({ type: "success", title: "Referral code copied" });
    } catch {
      showToast({ type: "error", title: "Could not copy. Select the code and copy it manually." });
    }
  }

  return (
    <div>
      <h1 className="h1">Rewards</h1>
      <p className="sub">Your loyalty points, wallet credit and referrals.</p>
      <div className="grid3" style={{ marginTop: 24 }}>
        <StatCard label="Loyalty Points" value={points === null ? "—" : String(points)} />
        <StatCard label="Wallet Credit" value={me ? formatNpr(me.wallet) : "—"} />
        <StatCard label="Friends Referred" value={referrals === null ? "—" : String(referrals)} />
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Refer a Friend</h3>
        {me?.referralCode ? (
          <EmptyState
            title={`Your code: ${me.referralCode}`}
            description={
              referralCredit && referralCredit > 0
                ? `Friends who sign up with your code get NPR ${referralCredit.toLocaleString("en-US")} in credit.`
                : "Share your code with friends when they sign up."
            }
            action={{ label: "Copy Referral Code", onClick: copyCode }}
          />
        ) : (
          <EmptyState title="Your referral code is not ready yet" description="Please refresh the page in a moment." />
        )}
      </div>
    </div>
  );
}
