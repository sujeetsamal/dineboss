"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  Grid3x3,
  LayoutDashboard,
  QrCode,
  Receipt,
  Settings,
  Sun,
  Moon,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";

const NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/live-orders", icon: ClipboardList, label: "Live Orders" },
  { href: "/kitchen", icon: ChefHat, label: "Kitchen Screen" },
  { href: "/admin/menu", icon: UtensilsCrossed, label: "Menu" },
  { href: "/admin/tables", icon: Grid3x3, label: "Tables" },
  { href: "/admin/qr", icon: QrCode, label: "QR Codes" },
  { href: "/admin/staff", icon: Users, label: "Staff" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/admin/pos-billing", icon: CreditCard, label: "POS Billing" },
  { href: "/admin/bills-history", icon: Receipt, label: "Bill History" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminShell({
  restaurantName,
  activeOrders = 0,
  occupiedTables = 0,
  totalTables = 0,
  children,
}) {
  const { user } = useCurrentUser();
  const { theme, toggleTheme, mounted } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    toast.success("Logged out");
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-bg-primary pb-16 md:pb-0">
      <aside className="hidden w-[240px] flex-col border-r border-border-theme bg-bg-primary md:flex">
        <div className="border-b border-border-theme p-4">
          <h1 className="font-display text-3xl text-gold">DineBoss</h1>
          <p className="mt-1 text-sm text-text-secondary">{restaurantName || "Your Restaurant"}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-r-xl border-l-2 px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-gold text-gold bg-gold/10"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.href === "/admin/live-orders" && activeOrders > 0 ? (
                  <span className="ml-auto h-2 w-2 rounded-full bg-danger" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border-theme p-4 text-xs text-text-secondary">
          <p className="truncate">{user?.email}</p>
          <button type="button" onClick={handleLogout} className="mt-2 w-full rounded-lg border border-border-theme px-3 py-2">
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border-theme px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4">
            {/* Restaurant Name & Time */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">{restaurantName || "Your Restaurant"}</h2>
                <p className="text-xs text-text-muted">Welcome back, {user?.displayName || "Chef"} 👋</p>
              </div>
              <div className="flex items-center gap-4">
                {mounted && (
                  <button
                    onClick={toggleTheme}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border-theme hover:border-gold hover:bg-gold/10 transition"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'dark' ? <Sun size={18} className="text-gold" /> : <Moon size={18} />}
                  </button>
                )}
                {mounted && (
                  <div className="text-sm text-text-secondary">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    {' '}
                    <span className="font-mono">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge-amber">
                Tables: {occupiedTables}/{totalTables} occupied
              </span>
              <span className={activeOrders > 0 ? "badge-red" : "badge-green"}>Active Orders: {activeOrders}</span>
            </div>
          </div>
          <div className="mt-4 h-px w-full bg-gold/40" />
        </header>
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-border-theme bg-bg-card p-2 md:hidden">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] ${isActive ? "text-gold" : "text-text-secondary"}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
