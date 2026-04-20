'use client';

import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import AdminShell from '@/components/AdminShell';
import { getRestaurant, getRestaurantSettings, updateRestaurant, updateRestaurantSettings } from '@/lib/firestore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import DomainSettings from '@/components/DomainSettings';

export default function SettingsPage() {
  const { loading, restaurantId, error: userError } = useCurrentUser({ allowedRoles: ['admin'] });
  const [settings, setSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('default');
  const [isElectron, setIsElectron] = useState(false);
  const logoInputRef = useRef(null);
  const paymentQRInputRef = useRef(null);
  const [isUploadingPaymentQR, setIsUploadingPaymentQR] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then((data) => {
        if (data) {
          setSettings({
            ...data,
            billPrefix: data.billPrefix || 'DB',
            defaultGstPercent: data.defaultGstPercent || 5,
            billFooterMessage: data.billFooterMessage || 'Thank you for dining with us!',
            showGstOnBill: data.showGstOnBill !== false,
            showLogoOnBill: data.showLogoOnBill !== false,
            defaultPaperSize: data.defaultPaperSize || '80mm',
            thankYouMessage: data.thankYouMessage || 'Thank you for dining with us!',
            requireCustomerDetails: false,
            enableCustomerQRPayment: data.enableCustomerQRPayment !== false,
          });
        }
      })
      .catch((err) => setError(err.message || 'Failed to load settings'));
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    getRestaurantSettings(restaurantId)
      .then((data) => {
        setSettings((prev) => (prev ? { ...prev, ...data } : prev));
      })
      .catch((err) => console.warn('Failed to load order-flow settings:', err));
  }, [restaurantId]);

  // Load printers from Electron
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isElectronApp = window.electronAPI?.isElectron;
    setIsElectron(isElectronApp);

    if (isElectronApp) {
      // Initial load
      window.electronAPI.getPrinters().then(printers => {
        setAvailablePrinters(printers);
        
        // Auto-select default printer or saved printer
        const defaultPrinter = printers.find(p => p.isDefault);
        const savedPrinter = localStorage.getItem('dineboss_printer_name');
        
        if (savedPrinter) {
          setSelectedPrinter(savedPrinter);
        } else if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.name);
          localStorage.setItem('dineboss_printer_name', defaultPrinter.name);
        }
      }).catch(err => {
        console.error('Failed to load printers:', err);
      });

      // Listen for printer updates every 30 seconds
      const handlePrintersUpdated = (updatedPrinters) => {
        setAvailablePrinters(prevPrinters => {
          // Merge status updates with existing printer info
          return prevPrinters.map(p => {
            const updated = updatedPrinters.find(u => u.name === p.name);
            return updated ? { ...p, ...updated } : p;
          });
        });
      };

      window.electronAPI.onPrintersUpdated(handlePrintersUpdated);

      // Cleanup
      return () => window.electronAPI.removePrintersListener();
    } else {
      // Load saved printer from localStorage even if not Electron
      const savedPrinter = localStorage.getItem('dineboss_printer_name');
      if (savedPrinter) {
        setSelectedPrinter(savedPrinter);
      }
    }
  }, []);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const storageRef = ref(storage, `restaurants/${restaurantId}/logo`);
      await uploadBytes(storageRef, file);
      const logoUrl = await getDownloadURL(storageRef);
      setSettings({ ...settings, logoUrl });
      toast.success('Logo uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload logo');
      console.error(err);
    } finally {
      setIsUploadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    setSettings({ ...settings, logoUrl: null });
  }

  async function handlePaymentQRUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploadingPaymentQR(true);
    try {
      const storageRef = ref(storage, `restaurants/${restaurantId}/payment_qr`);
      await uploadBytes(storageRef, file);
      const paymentQRUrl = await getDownloadURL(storageRef);
      setSettings({ ...settings, paymentQRUrl });
      toast.success('Payment QR uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload payment QR');
      console.error(err);
    } finally {
      setIsUploadingPaymentQR(false);
    }
  }

  function handleRemovePaymentQR() {
    setSettings({ ...settings, paymentQRUrl: null });
  }

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
        phone: settings.phone || '',
        email: settings.email || '',
        addressLine1: settings.addressLine1 || '',
        addressLine2: settings.addressLine2 || '',
        city: settings.city || '',
        state: settings.state || '',
        pincode: settings.pincode || '',
        gstNumber: settings.gstNumber || '',
        fssaiNumber: settings.fssaiNumber || '',
        website: settings.website || '',
        billPrefix: settings.billPrefix || 'DB',
        defaultGstPercent: parseInt(settings.defaultGstPercent) || 5,
        billFooterMessage: settings.billFooterMessage || '',
        showGstOnBill: settings.showGstOnBill,
        showLogoOnBill: settings.showLogoOnBill,
        logoUrl: settings.logoUrl || null,
        paymentQRUrl: settings.paymentQRUrl || null,
        orderLimitPerDay: parseInt(settings.orderLimitPerDay) || 50,
        enableOrderSound: settings.enableOrderSound !== false,
        defaultPaperSize: settings.defaultPaperSize || '80mm',
        thankYouMessage: settings.thankYouMessage || 'Thank you for dining with us!',
        enableCustomerQRPayment: settings.enableCustomerQRPayment !== false,
      });
      toast.success('Settings saved');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
      toast.error('Could not save settings');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCustomerDetailsToggle(nextValue) {
    if (!restaurantId || !settings) return;
    const previous = settings.requireCustomerDetails;
    setSettings({ ...settings, requireCustomerDetails: nextValue });
    try {
      await updateRestaurantSettings(restaurantId, { requireCustomerDetails: nextValue });
      toast.success('Customer details setting saved');
    } catch (err) {
      setSettings({ ...settings, requireCustomerDetails: previous });
      toast.error('Could not save customer details setting');
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
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="font-display text-3xl text-gold">Settings</h1>
          <p className="mt-1 text-sm text-text-muted">Manage your restaurant configuration and preferences</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">{error}</div>}

        {/* RESTAURANT PROFILE SECTION */}
        <div className="card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-gold">Restaurant Profile</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Restaurant Name *</label>
              <input
                type="text"
                value={settings.name || ''}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
                placeholder="Your restaurant name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number</label>
              <input
                type="tel"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
                placeholder="e.g., +91 9876543210"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="contact@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Address Line 1</label>
            <input
              type="text"
              value={settings.addressLine1 || ''}
              onChange={(e) => setSettings({ ...settings, addressLine1: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="Street address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Address Line 2</label>
            <input
              type="text"
              value={settings.addressLine2 || ''}
              onChange={(e) => setSettings({ ...settings, addressLine2: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="Apartment, suite, etc. (optional)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">City</label>
              <input
                type="text"
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">State</label>
              <input
                type="text"
                value={settings.state || ''}
                onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
                placeholder="State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Pincode</label>
              <input
                type="text"
                value={settings.pincode || ''}
                onChange={(e) => setSettings({ ...settings, pincode: e.target.value })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
                placeholder="123456"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">GST Number (optional)</label>
            <input
              type="text"
              value={settings.gstNumber || ''}
              onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="e.g., 27AABCT1234A1Z5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">FSSAI Number (optional)</label>
            <input
              type="text"
              value={settings.fssaiNumber || ''}
              onChange={(e) => setSettings({ ...settings, fssaiNumber: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="Food Safety Registration"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Website (optional)</label>
            <input
              type="url"
              value={settings.website || ''}
              onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="https://yourrestaurant.com"
            />
          </div>
        </div>

        {/* BILL SETTINGS SECTION */}
        <div className="card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-gold">Bill Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Bill Prefix</label>
              <input
                type="text"
                value={settings.billPrefix || 'DB'}
                onChange={(e) => setSettings({ ...settings, billPrefix: e.target.value })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
                placeholder="e.g., DB (becomes DB-0001)"
                maxLength="5"
              />
              <p className="text-xs text-text-muted mt-1">Bill numbers will be formatted as PREFIX-0001</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Default GST %</label>
              <select
                value={settings.defaultGstPercent || 5}
                onChange={(e) => setSettings({ ...settings, defaultGstPercent: parseInt(e.target.value) })}
                className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary"
              >
                <option value="0">0% (No GST)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Bill Footer Message</label>
            <textarea
              value={settings.billFooterMessage || ''}
              onChange={(e) => setSettings({ ...settings, billFooterMessage: e.target.value })}
              rows="3"
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="e.g., Thank you for dining with us! Please visit again 🙏"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showGstOnBill !== false}
                onChange={(e) => setSettings({ ...settings, showGstOnBill: e.target.checked })}
                className="w-4 h-4 rounded border-text-muted/30 text-gold"
              />
              <span className="ml-2 text-sm text-text-secondary">Show GST on bill</span>
            </label>
          </div>
        </div>

        {/* APPEARANCE SECTION */}
        <div className="card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-gold">Appearance</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Restaurant Logo</label>
            
            <div className="flex flex-col gap-4">
              {settings.logoUrl && (
                <div className="relative inline-block">
                  <img
                    src={settings.logoUrl}
                    alt="Restaurant logo"
                    className="h-32 w-32 object-cover rounded-lg border border-text-muted/30"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {!settings.logoUrl && (
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="border-2 border-dashed border-text-muted/30 rounded-lg p-8 text-center cursor-pointer hover:border-gold/50 transition flex flex-col items-center justify-center"
                >
                  <Upload size={32} className="text-gold mb-2" />
                  <p className="text-sm font-medium">Click to upload logo</p>
                  <p className="text-xs text-text-muted">PNG, JPG, GIF up to 5MB</p>
                </div>
              )}

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
                className="hidden"
              />

              {isUploadingLogo && (
                <div className="text-sm text-text-muted flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-gold border-t-transparent rounded-full" />
                  Uploading...
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showLogoOnBill !== false}
                onChange={(e) => setSettings({ ...settings, showLogoOnBill: e.target.checked })}
                className="w-4 h-4 rounded border-text-muted/30 text-gold"
              />
              <span className="ml-2 text-sm text-text-secondary">Show logo on bills</span>
            </label>
          </div>
        </div>

        {/* NOTIFICATIONS SECTION */}
        <div className="card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-gold">Notifications</h2>

          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableOrderSound !== false}
                onChange={(e) => setSettings({ ...settings, enableOrderSound: e.target.checked })}
                className="w-4 h-4 rounded border-text-muted/30 text-gold"
              />
              <span className="ml-2 text-sm text-text-secondary">Play sound when new order arrives</span>
            </label>
          </div>

          <p className="text-xs text-text-muted">
            When enabled, the kitchen screen will play a notification sound and animate new orders.
          </p>
        </div>

        {/* QR ORDER SETTINGS SECTION */}
        <div className="card space-y-5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gold">Customer Details on QR Order</h2>
              <p className="mt-1 text-sm text-text-secondary">
                When ON, customers must provide name and phone before placing order.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCustomerDetailsToggle(!settings.requireCustomerDetails)}
              className={`relative h-8 w-14 rounded-full border transition ${
                settings.requireCustomerDetails
                  ? 'border-gold bg-gold'
                  : 'border-text-muted/30 bg-bg-secondary'
              }`}
              aria-pressed={settings.requireCustomerDetails}
              aria-label="Toggle customer details on QR order"
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                  settings.requireCustomerDetails ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Current: {settings.requireCustomerDetails ? 'ON - details required' : 'OFF - details optional'}
          </p>
        </div>

        {/* CUSTOMER PAYMENT QR SECTION */}
        <div className="card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-gold">Customer Payment QR</h2>
          <p className="text-sm text-text-secondary">
            Upload a payment QR code (UPI/Google Pay/etc.) that will be shown to customers when their meal is served.
          </p>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Payment QR Code</label>
            
            <div className="flex flex-col gap-4">
              {settings.paymentQRUrl && (
                <div className="relative inline-block">
                  <img
                    src={settings.paymentQRUrl}
                    alt="Payment QR code"
                    className="h-40 w-40 object-cover rounded-lg border border-text-muted/30"
                  />
                  <button
                    onClick={handleRemovePaymentQR}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {!settings.paymentQRUrl && (
                <div
                  onClick={() => paymentQRInputRef.current?.click()}
                  className="border-2 border-dashed border-text-muted/30 rounded-lg p-8 text-center cursor-pointer hover:border-gold/50 transition flex flex-col items-center justify-center"
                >
                  <Upload size={32} className="text-gold mb-2" />
                  <p className="text-sm font-medium">Click to upload payment QR</p>
                  <p className="text-xs text-text-muted">PNG, JPG up to 5MB</p>
                </div>
              )}

              <input
                ref={paymentQRInputRef}
                type="file"
                accept="image/*"
                onChange={handlePaymentQRUpload}
                disabled={isUploadingPaymentQR}
                className="hidden"
              />

              {isUploadingPaymentQR && (
                <div className="text-sm text-text-muted flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-gold border-t-transparent rounded-full" />
                  Uploading...
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableCustomerQRPayment !== false}
                onChange={(e) => setSettings({ ...settings, enableCustomerQRPayment: e.target.checked })}
                className="w-4 h-4 rounded border-text-muted/30 text-gold"
              />
              <span className="ml-2 text-sm text-text-secondary">Show payment QR in order completion</span>
            </label>
          </div>
          <p className="text-xs text-text-muted">
            When enabled, customers will see the payment QR code when their order is completed.
          </p>
        </div>
        <div className="card space-y-5 p-6">
          <h2 className="text-lg font-semibold text-gold">Thermal Printer Settings</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Default Paper Size</label>
            <div className="flex gap-2 flex-wrap">
              {['50mm', '58mm', '80mm'].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setSettings({ ...settings, defaultPaperSize: size });
                  }}
                  className={`px-4 py-2 rounded-full font-medium transition border ${
                    settings.defaultPaperSize === size
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-600 text-gray-400 hover:border-amber-500/50'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Electron Printer Detection */}
          {isElectron && availablePrinters.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Select Printer</label>
              <div className="space-y-2">
                {availablePrinters.map((printer) => (
                  <label key={printer.name} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="printer"
                      value={printer.name}
                      checked={selectedPrinter === printer.name}
                      onChange={(e) => {
                        setSelectedPrinter(e.target.value);
                        localStorage.setItem('dineboss_printer_name', e.target.value);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">
                      {printer.isDefault ? '🟢' : printer.status === 'ready' ? '🟢' : '🔴'}
                      {' '}
                      {printer.name}
                      {printer.isDefault ? ' (Default)' : ''}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({printer.status})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : isElectron ? (
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800 text-sm">
              📢 No printers detected. Please install a thermal printer driver.
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 p-3 text-amber-800 text-sm">
              💻 Install <strong>DineBoss Desktop App</strong> for automatic printer detection and silent printing.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Thank You Message</label>
            <textarea
              value={settings.thankYouMessage || 'Thank you for dining with us!'}
              onChange={(e) => setSettings({ ...settings, thankYouMessage: e.target.value })}
              rows="3"
              className="form-input w-full rounded-lg border border-text-muted/30 bg-bg-secondary px-3 py-2 text-text-primary placeholder-text-muted/50"
              placeholder="Thank you for dining with us!"
            />
            <p className="text-xs text-text-muted mt-1">This message will appear on printed bills and receipts</p>
          </div>
        </div>

        {/* DOMAIN SETTINGS SECTION */}
        {restaurantId && (
          <div className="card space-y-5 p-6">
            <h2 className="text-lg font-semibold text-gold">Domain & Multi-Tenant Access</h2>
            <DomainSettings restaurantId={restaurantId} restaurantName={settings?.name} />
          </div>
        )}

        {/* SAVE BUTTON */}
        <div className="flex gap-4 justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-gold px-8 py-2"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
