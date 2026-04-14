'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UtensilsCrossed, Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        setError('User profile not found. Contact your admin.');
        setLoading(false);
        return;
      }
      const role = snap.data().role;
      toast.success('Welcome back!');
      router.push(role === 'admin' ? '/admin' : '/waiter');
    } catch {
      setError('Invalid email or password. Please try again.');
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
          <p className="text-sm" style={{ color: '#7C6A4F' }}>Restaurant Management Platform</p>
        </div>

        <div className="h-px mb-8" style={{ background: 'linear-gradient(to right, transparent, #2E1F0A, transparent)' }} />

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@restaurant.com"
              className="input-gold"
            />
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: '#C4B89A' }}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-gold pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#7C6A4F' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#7F1D1D33', border: '1px solid #7F1D1D', color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2 mt-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: '#7C6A4F' }}>
          New restaurant?{' '}
          <Link href="/signup" style={{ color: '#F59E0B' }}>Create account →</Link>
        </p>
      </div>
    </div>
  );
}
