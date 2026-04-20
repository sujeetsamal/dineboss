"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WaiterBillingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/waiter");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 text-text-primary">
      <p className="text-sm text-text-muted">Opening waiter panel...</p>
    </main>
  );
}
