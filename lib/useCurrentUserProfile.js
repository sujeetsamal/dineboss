"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/firestore";

export function useCurrentUserProfile({ allowedRoles = [], redirectTo = "/login" } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(redirectTo);
        setLoading(false);
        return;
      }
      setFirebaseUser(user);
      try {
        const userProfile = await getUserProfile(user.uid);
        if (!userProfile) {
          setError("User profile missing.");
          setLoading(false);
          return;
        }
        if (allowedRoles.length && !allowedRoles.includes(userProfile.role)) {
          router.replace(userProfile.role === "admin" ? "/admin" : "/waiter");
          setLoading(false);
          return;
        }
        setProfile(userProfile);
      } catch (profileError) {
        setError(profileError.message || "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [allowedRoles, redirectTo, router]);

  return { loading, firebaseUser, profile, error, setError };
}
