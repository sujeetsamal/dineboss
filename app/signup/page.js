'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ restaurantName: '', yourName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;
      const restaurantRef = doc(collection(db, 'restaurants'));
      const restaurantId = restaurantRef.id;
      await setDoc(restaurantRef, {
        name: form.restaurantName,
        ownerId: uid,
        createdAt: serverTimestamp(),
        plan: 'free',
        orderLimitPerDay: 50
      });
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: form.email,
        displayName: form.yourName,
        role: 'admin',
        restaurantId,
        createdAt: serverTimestamp()
      });
      toast.success('Restaurant created! Welcome to DineBoss.');
      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0D0A06', backgroundImage: 'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)' }}>
      <div className="w-full max-w-md rounded-2xl p-10" style={{ background: '#161009', border: '1px solid #2E1F0A' }}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <UtensilsCrossed size={28} color="#F59E0B" />
          </div>
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#F59E0B' }}>DineBoss</h1>
          <p className="text-sm" style={{ color: '#7C6A4F' }}>Create your restaurant account</p>
        </div>

        <div className="h-px mb-8" style={{ background: 'linear-gradient(to right, transparent, #2E1F0A, transparent)' }} />

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Restaurant Name</label>
            <input type="text" value={form.restaurantName} onChange={e => setField('restaurantName', e.target.value)} required placeholder="e.g. The Golden Fork" className="input-gold" />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Your Name</label>
            <input type="text" value={form.yourName} onChange={e => setField('yourName', e.target.value)} required placeholder="Your full name" className="input-gold" />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Email</label>
            <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required placeholder="you@restaurant.com" className="input-gold" />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Password</label>
            <input type="password" value={form.password} onChange={e => setField('password', e.target.value)} required placeholder="Min 6 characters" className="input-gold" />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Confirm Password</label>
            <input type="password" value={form.confirm} onChange={e => setField('confirm', e.target.value)} required placeholder="Repeat password" className="input-gold" />
          </div>

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#7F1D1D33', border: '1px solid #7F1D1D', color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2 mt-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create Restaurant Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: '#7C6A4F' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#F59E0B' }}>Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
