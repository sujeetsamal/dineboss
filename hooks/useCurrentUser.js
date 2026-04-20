'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firestore';
import { getDefaultPermissionsForRole } from '@/lib/permissions';

export function useCurrentUser({ allowedRoles = [], redirectTo = '/login' } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [restaurantId, setRestaurantId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        setUser(null);
        setProfile(null);
        setRole(null);
        setPermissions({});
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
          router.replace(profile.role === 'admin' || profile.role === 'owner' || profile.role === 'manager' ? '/admin' : '/waiter');
          setLoading(false);
          return;
        }

        // Get permissions from user profile or use role defaults
        const userPermissions = profile.permissions || getDefaultPermissionsForRole(profile.role);

        setUser(authUser);
        setProfile(profile);
        setRole(profile.role);
        setPermissions(userPermissions);
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

  return { loading, user, profile, role, permissions, restaurantId, error, setError };
}
