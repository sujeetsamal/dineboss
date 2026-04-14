'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminShell from '@/components/AdminShell';
import { getRestaurant, updateRestaurant } from '@/lib/firestore';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function SettingsPage() {
  const { loading, restaurantId, error: userError } = useCurrentUser({ allowedRoles: ['admin'] });
  const [settings, setSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => setError(err.message || 'Failed to load settings'));
  }, [restaurantId]);

  async function handleSave() {
    if (!restaurantId) return;
    if (!settings.name?.trim()) {
      toast.error('Restaurant name is required');
      return;
    }
    setIsSaving(true);
    try {
      await updateRestaurant(restaurantId, {
        name: settings.name,
        description: settings.description,
        orderLimitPerDay: parseInt(settings.orderLimitPerDay) || 50,
      });
      toast.success('Settings saved');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
      toast.error('Could not save settings');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-text-muted">Loading settings...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (userError) {
    return (
      <AdminShell>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">Error: {userError}</div>
      </AdminShell>
    );
  }

  if (!settings) {
    return (
      <AdminShell>
        <div className="text-center text-text-muted">Restaurant settings not found</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell restaurantName={settings?.name}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-3xl text-gold">Settings</h1>
          <p className="mt-1 text-sm text-text-muted">Manage your restaurant settings</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">{error}</div>}

        <div className="card space-y-5 p-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Restaurant Name</label>
            <input
              type="text"
              value={settings.name || ''}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="Your restaurant name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
            <textarea
              value={settings.description || ''}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              rows="4"
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="Restaurant description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Daily Order Limit</label>
            <input
              type="number"
              value={settings.orderLimitPerDay || 50}
              onChange={(e) => setSettings({ ...settings, orderLimitPerDay: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary"
              min="10"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-gold w-full"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
