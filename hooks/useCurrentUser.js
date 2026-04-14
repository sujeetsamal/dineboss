'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firestore';

export function useCurrentUser({ allowedRoles = [], redirectTo = '/login' } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        setUser(null);
        setRole(null);
        setRestaurantId(null);
        setLoading(false);
        router.replace(redirectTo);
        return;
      }

      try {
        const profile = await getUserProfile(authUser.uid);
        if (!profile) {
          setError('User profile not found.');
          setLoading(false);
          return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
          router.replace(profile.role === 'admin' ? '/admin' : '/waiter');
          setLoading(false);
          return;
        }

        setUser(authUser);
        setRole(profile.role);
        setRestaurantId(profile.restaurantId);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load user profile');
        setLoading(false);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [allowedRoles, redirectTo, router]);

  return { loading, user, role, restaurantId, error, setError };
}
