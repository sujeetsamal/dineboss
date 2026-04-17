"use client";

import { useEffect, useState } from "react";
import { CreditCard, TrendingUp, AlertCircle } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { getRestaurant, updateRestaurantPlan } from "@/lib/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import toast from "react-hot-toast";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 199,
    orderLimit: 500,
    description: "Perfect for small restaurants",
    features: ["Up to 500 orders/month", "Basic analytics", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 499,
    orderLimit: 1000,
    description: "For growing businesses",
    features: ["Up to 1,000 orders/month", "Advanced analytics", "Priority support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 899,
    orderLimit: 2000,
    description: "For established restaurants",
    features: ["Up to 2,000 orders/month", "Premium analytics", "Dedicated support"],
  },
  {
    id: "scale",
    name: "Scale",
    price: 1499,
    orderLimit: 999999,
    description: "Unlimited growth",
    features: ["Unlimited orders", "White-label options", "24/7 priority support"],
  },
];

export default function BillingPage() {
  const { loading, user, restaurantId, error, setError } = useCurrentUser({ allowedRoles: ["admin"] });
  const [restaurant, setRestaurant] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then(setRestaurant)
      .catch((e) => setError(e.message || "Failed to load billing info"));
  }, [restaurantId, setError]);

  const currentPlan = PLANS.find((p) => p.id === restaurant?.plan) || PLANS[0];
  const usage = restaurant?.currentUsage || 0;
  const limit = restaurant?.orderLimit || 500;
  const usagePercent = Math.min((usage / limit) * 100, 100);

  async function handleUpgrade(planId) {
    if (!restaurantId) return;
    setUpgrading(true);
    try {
      await updateRestaurantPlan(restaurantId, planId);
      setRestaurant((prev) => ({ ...prev, plan: planId }));
      toast.success(`Upgraded to ${PLANS.find((p) => p.id === planId)?.name} plan!`);
    } catch (err) {
      toast.error("Upgrade failed: " + (err.message || "Try again"));
      setError(err.message);
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading billing...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell restaurantName={restaurant?.name}>
      {error && <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      {/* Current Plan Card */}
      <div className="mb-6 card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-3xl text-gold">{currentPlan.name}</h2>
            <p className="text-text-secondary">Current Plan</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">₹{currentPlan.price}</p>
            <p className="text-xs text-text-muted">/month</p>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-text-secondary">Monthly Usage</span>
            <span className="font-mono text-gold">
              {usage} / {limit >= 999999 ? "∞" : limit}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-border-theme overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {usagePercent > 80 && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={14} /> Usage limit high
            </p>
          )}
        </div>

        {/* Billing Period */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-theme">
          <div>
            <p className="text-xs text-text-muted">Start Date</p>
            <p className="text-sm font-semibold">
              {restaurant?.billingStartDate?.toDate?.()?.toLocaleDateString("en-IN") || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Renewal Date</p>
            <p className="text-sm font-semibold">
              {restaurant?.billingEndDate?.toDate?.()?.toLocaleDateString("en-IN") || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <h3 className="mb-4 font-display text-2xl">Available Plans</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === restaurant?.plan;
          return (
            <div
              key={plan.id}
              className={`card p-4 transition ${isCurrent ? "border-gold ring-1 ring-gold" : ""}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h4 className="font-display text-xl">{plan.name}</h4>
                  <p className="text-xs text-text-secondary">{plan.description}</p>
                </div>
                {isCurrent && <span className="badge-amber">Current</span>}
              </div>

              <p className="mb-4">
                <span className="text-2xl font-bold text-gold">₹{plan.price}</span>
                <span className="text-xs text-text-muted">/month</span>
              </p>

              <ul className="mb-4 space-y-2 text-xs">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button className="w-full py-2 rounded-lg border border-gold text-gold text-sm font-semibold cursor-default">
                  Active Plan
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading}
                  className="w-full btn-gold text-sm"
                >
                  {upgrading ? "Upgrading..." : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment Info */}
      <div className="mt-8 card p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-1 text-blue-400" size={20} />
          <div>
            <h4 className="font-semibold text-blue-300">Payment Method</h4>
            <p className="mt-1 text-sm text-text-secondary">
              Razorpay integration coming soon. For now, upgrades are manually verified and activated.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
