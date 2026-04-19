'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X, ChevronDown, ExternalLink, ChefHat, BarChart3, Users, Smartphone, QrCode, ClipboardList } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const canvasRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [expandedTerms, setExpandedTerms] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Three.js particle initialization
  useEffect(() => {
    if (!canvasRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = () => {
      const THREE = window.THREE;
      const canvas = canvasRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      camera.position.z = 50;

      // Create particles
      const particleGeometry = new THREE.BufferGeometry();
      const particleCount = 1500;
      const positions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i + 1] = (Math.random() - 0.5) * 200;
        positions[i + 2] = (Math.random() - 0.5) * 100;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleMaterial = new THREE.PointsMaterial({
        color: 0xF59E0B,
        size: 0.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Add ambient light
      const light = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(light);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        particles.rotation.z += 0.0001;
        renderer.render(scene, camera);
      };

      // Handle resize
      const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);
      animate();

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
      };
    };

    document.body.appendChild(script);
  }, []);

  // Scroll to section
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const faqItems = [
    {
      q: 'Is there really a 3-month free trial?',
      a: 'Yes! Every new restaurant gets 3 full months completely free. No credit card needed to start.'
    },
    {
      q: 'What is the ₹3,000 setup fee for?',
      a: 'This one-time fee covers your initial setup, QR code generation for all tables, menu onboarding, and a training session with our team.'
    },
    {
      q: 'Can my waiters use their own phones?',
      a: 'Absolutely. DineBoss is mobile-first. Waiters log in from any smartphone browser — no app download needed.'
    },
    {
      q: 'How does the QR ordering work for customers?',
      a: 'Each table gets a unique QR code. Customers scan it, browse your menu, and place orders directly. Orders appear instantly on your kitchen screen and dashboard.'
    },
    {
      q: 'Can I upgrade or downgrade my plan?',
      a: 'Yes, you can change your plan anytime from the settings page. Changes take effect from the next billing cycle.'
    },
    {
      q: 'Is my data secure?',
      a: 'Yes. DineBoss uses Firebase with enterprise-grade security. Your restaurant data is isolated and encrypted.'
    }
  ];

  const termsContent = `
Terms & Conditions
Last updated: January 2025

1. ACCEPTANCE OF TERMS
By accessing and using DineBoss, you agree to be bound by these terms and conditions. If you do not agree, please do not use this service.

2. SERVICE DESCRIPTION
DineBoss is a cloud-based restaurant management platform providing order management, table management, kitchen display systems, analytics, and staff management for restaurants. The service is provided via web browsers without app downloads.

3. SUBSCRIPTION AND BILLING
- Pricing Plans: Basic (₹199/month), Standard (₹499/month), Pro (₹899/month), Enterprise (₹1,499/month)
- Free Trial: All new restaurants receive 3 full months free (no credit card required)
- Setup Fee: A one-time ₹3,000 setup fee includes QR setup, menu onboarding, and training
- Billing Cycle: Monthly. Changes to plans take effect from the next billing month.
- Payment Methods: Credit/Debit cards and digital wallets accepted
- Taxes: GST will be applied as applicable to your billing address

4. CANCELLATION POLICY
You can cancel your subscription anytime from settings. Cancellation takes effect at the end of your current billing period. No refunds for unused portions.

5. DATA PRIVACY AND SECURITY
- Your restaurant data, customer data, and order information are encrypted and securely stored in Firebase
- DineBoss complies with data protection regulations
- Regular automated backups are maintained
- You retain full ownership of your data

6. LIMITATION OF LIABILITY
DineBoss is provided on an "as-is" basis. We are not liable for service interruptions, data loss, or indirect damages. Our liability is limited to the amount you paid in the last 30 days.

7. CONTACT INFORMATION
For support, disputes, or questions: support@dineboss.in
For legal inquiries: legal@dineboss.in
  `;

  return (
    <div className="bg-[#0D0A06] text-[#FFF5E4] min-h-screen">
      {/* Import Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Inter', sans-serif;
        }
        
        .playfair {
          font-family: 'Playfair Display', serif;
        }
        
        @media print {
          body * { visibility: hidden; }
          #bill-print-area, #bill-print-area * { visibility: visible; }
          #bill-print-area { position: fixed; top: 0; left: 0; width: 80mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0D0A06]/80 backdrop-blur-lg border-b border-[#F59E0B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#F59E0B] rounded flex items-center justify-center">
              <span className="text-[#0D0A06] font-bold">🍽️</span>
            </div>
            <span className="playfair text-2xl font-bold text-[#F59E0B]">DineBoss</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex gap-8">
            <button onClick={() => scrollToSection('top')} className="hover:text-[#F59E0B] transition">Home</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-[#F59E0B] transition">Pricing</button>
            <button onClick={() => scrollToSection('about')} className="hover:text-[#F59E0B] transition">About Us</button>
            <button onClick={() => scrollToSection('terms')} className="hover:text-[#F59E0B] transition">Terms</button>
          </div>

          <div className="flex gap-4 items-center">
            <Link href="/login" className="hidden md:block btn-gold px-6 py-2 bg-[#F59E0B] text-[#0D0A06] rounded-lg font-semibold hover:bg-[#E59E0B] transition text-sm">
              Start Free Trial
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden">
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0D0A06] border-t border-[#F59E0B]/10 p-4 flex flex-col gap-3">
            <button onClick={() => scrollToSection('top')} className="hover:text-[#F59E0B] transition text-left">Home</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-[#F59E0B] transition text-left">Pricing</button>
            <button onClick={() => scrollToSection('about')} className="hover:text-[#F59E0B] transition text-left">About Us</button>
            <button onClick={() => scrollToSection('terms')} className="hover:text-[#F59E0B] transition text-left">Terms</button>
            <Link href="/login" className="btn-gold px-6 py-2 bg-[#F59E0B] text-[#0D0A06] rounded-lg font-semibold hover:bg-[#E59E0B] transition text-center">
              Start Free Trial
            </Link>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section id="top" className="relative h-screen flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D0A06]/90 via-transparent to-[#0D0A06]/90" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block bg-[#F59E0B]/20 text-[#F59E0B] px-4 py-2 rounded-full text-sm font-semibold mb-6">
            🍽️ Restaurant Management Platform
          </div>

          <h1 className="playfair text-6xl md:text-7xl font-bold mb-4">
            Run Your Restaurant
          </h1>
          <h2 className="playfair text-6xl md:text-7xl font-bold text-[#F59E0B] italic mb-6">
            Like a Boss.
          </h2>

          <p className="text-lg text-[#C4B89A] mb-2">Real-time orders. Smart tables. Happy customers.</p>
          <p className="text-lg text-[#C4B89A] mb-8">Built for Indian restaurants of every size.</p>

          <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
            <Link href="/login" className="bg-[#F59E0B] text-[#0D0A06] px-8 py-4 rounded-lg font-semibold hover:bg-[#E59E0B] transition flex items-center justify-center gap-2">
              Start Free Trial <span>→</span>
            </Link>
            <button onClick={() => setShowVideoModal(true)} className="border-2 border-[#F59E0B] text-[#F59E0B] px-8 py-4 rounded-lg font-semibold hover:bg-[#F59E0B]/10 transition">
              Watch Demo
            </button>
            <a href="https://github.com/sujeetsamal/dineboss/releases/latest/download/DineBoss-Setup.exe" className="border-2 border-[#F59E0B] text-[#F59E0B] px-8 py-4 rounded-lg font-semibold hover:bg-[#F59E0B]/10 transition flex items-center justify-center gap-2" target="_blank" rel="noopener noreferrer">
              💻 Download for Windows
            </a>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center text-sm text-[#C4B89A] mb-12">
            <span>✓ 3 months FREE</span>
            <span>✓ No credit card</span>
            <span>✓ Setup in minutes</span>
          </div>

          {/* Scroll indicator */}
          <div className="animate-bounce">
            <ChevronDown className="mx-auto text-[#F59E0B]" size={32} />
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-7xl mx-auto">
          <h2 className="playfair text-5xl font-bold text-center mb-4">Everything Your Restaurant Needs</h2>
          <p className="text-center text-[#C4B89A] mb-16 max-w-2xl mx-auto">
            All the tools to streamline your operations, from customer ordering to kitchen management to business analytics.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: QrCode, title: 'QR Table Ordering', desc: 'Customers scan and order directly. Zero wait time.' },
              { icon: ClipboardList, title: 'Live Order Dashboard', desc: 'See every order in real-time. Never miss a ticket.' },
              { icon: ChefHat, title: 'Kitchen Screen', desc: 'Dedicated kitchen display. Orders flow automatically.' },
              { icon: BarChart3, title: 'Smart Analytics', desc: 'Daily revenue, top items, peak hours. Data-driven decisions.' },
              { icon: Users, title: 'Staff Management', desc: 'Add waiters, track performance, manage shifts.' },
              { icon: Smartphone, title: 'Mobile Waiter App', desc: 'Waiters take orders from their phone. Fast and accurate.' }
            ].map((feature, i) => (
              <div key={i} className="bg-[#1A1612] border border-[#F59E0B]/20 p-8 rounded-xl hover:border-[#F59E0B] hover:shadow-lg hover:shadow-[#F59E0B]/20 transition group">
                <feature.icon className="text-[#F59E0B] mb-4 group-hover:scale-110 transition" size={32} />
                <h3 className="playfair text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-[#C4B89A]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-7xl mx-auto">
          <h2 className="playfair text-5xl font-bold text-center mb-16">Up and Running in Minutes</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: 1, title: 'Sign Up', desc: 'Create your restaurant account in 60 seconds' },
              { num: 2, title: 'Setup Menu', desc: 'Add your menu items, tables, and staff' },
              { num: 3, title: 'Go Live', desc: 'Print QR codes and start taking orders today' }
            ].map((step) => (
              <div key={step.num} className="relative">
                <div className="text-center">
                  <div className="playfair text-8xl font-bold text-[#F59E0B]/20 text-center">
                    {step.num}
                  </div>
                  <div className="relative -mt-16">
                    <h3 className="playfair text-3xl font-bold mb-3">{step.title}</h3>
                    <p className="text-[#C4B89A]">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-7xl mx-auto">
          <h2 className="playfair text-5xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-[#C4B89A] mb-4">First 3 months completely free. One-time setup fee ₹3,000.</p>
          <p className="text-center text-[#C4B89A] mb-16">No hidden charges. Cancel anytime.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              {
                name: 'BASIC',
                price: '₹199',
                period: '/month',
                desc: 'Perfect for small cafes',
                sub: 'Designed for restaurants handling up to 500 orders/day',
                features: ['Waiter order system', 'Table management', 'Live order dashboard', 'Menu management', 'QR ordering', 'Order status tracking', 'Basic analytics', 'Up to 3 staff accounts'],
                cta: 'Start Free Trial',
                highlight: false
              },
              {
                name: 'STANDARD',
                price: '₹499',
                period: '/month',
                desc: 'Best for growing restaurants',
                sub: 'Designed for restaurants handling up to 1,000 orders/day',
                features: ['Everything in Basic', 'Up to 10 staff accounts', 'Advanced analytics', 'Top selling items', 'Sound notifications', 'Smart table tracking', 'Order history', 'Priority support'],
                cta: 'Start Free Trial',
                highlight: true
              },
              {
                name: 'PRO',
                price: '₹899',
                period: '/month',
                desc: 'For high-traffic restaurants',
                sub: 'Designed for restaurants handling up to 2,000 orders/day',
                features: ['Everything in Standard', 'Unlimited staff accounts', 'Detailed analytics', 'Staff performance', 'Peak hour insights', 'Faster sync', 'Downloadable reports', 'High performance mode'],
                cta: 'Start Free Trial',
                highlight: false
              },
              {
                name: 'ENTERPRISE',
                price: '₹1,499',
                period: '/month',
                desc: 'For chains & high-volume',
                sub: 'Designed for restaurants handling 5,000+ orders/day',
                features: ['Everything in Pro', 'Dedicated optimization', 'Multi-branch support', 'Custom features', 'Advanced security', 'Custom integrations', 'Priority infrastructure', 'Fast response'],
                cta: 'Contact Us',
                highlight: false
              }
            ].map((plan, i) => (
              <div key={i} className={`rounded-xl p-8 transition transform hover:scale-105 ${plan.highlight ? 'bg-[#F59E0B]/10 border-2 border-[#F59E0B]' : 'bg-[#1A1612] border border-[#F59E0B]/20'}`}>
                {plan.highlight && (
                  <div className="text-center bg-[#F59E0B] text-[#0D0A06] px-4 py-1 rounded-full text-xs font-bold mb-4 inline-block w-full">
                    Most Popular
                  </div>
                )}
                <h3 className="playfair text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-xs text-[#C4B89A] mb-2">{plan.desc}</p>
                <p className="text-xs text-[#C4B89A] mb-6">{plan.sub}</p>
                <div className="mb-6">
                  <span className="playfair text-4xl font-bold">{plan.price}</span>
                  <span className="text-[#C4B89A]">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="text-sm text-[#C4B89A] flex items-start">
                      <span className="text-[#F59E0B] mr-2">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login" className={`block text-center py-3 rounded-lg font-semibold transition ${plan.highlight ? 'bg-[#F59E0B] text-[#0D0A06] hover:bg-[#E59E0B]' : 'border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-8 text-center">
            <p className="text-lg font-semibold mb-2">🎉 First 3 months FREE for all new restaurants!</p>
            <p className="text-[#C4B89A]">One-time setup fee of ₹3,000 includes QR setup, menu onboarding & training</p>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="bg-[#1A1612] border border-[#F59E0B]/20 rounded-xl p-8 flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-6xl mb-4">🏪</div>
                <p className="text-[#C4B89A]">DineBoss - Restaurant Management</p>
              </div>
            </div>

            <div>
              <h2 className="playfair text-5xl font-bold mb-6">About DineBoss</h2>
              <p className="text-[#C4B89A] mb-8 leading-relaxed">
                DineBoss was built by restaurant owners, for restaurant owners. We saw how restaurants in India struggled with paper order books, miscommunication between waiters and kitchen, and zero visibility into their own business data. So we built the solution.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-[#1A1612] border border-[#F59E0B]/20 p-6 rounded-lg text-center">
                  <div className="playfair text-3xl font-bold text-[#F59E0B] mb-2">500+</div>
                  <p className="text-sm text-[#C4B89A]">Restaurants</p>
                </div>
                <div className="bg-[#1A1612] border border-[#F59E0B]/20 p-6 rounded-lg text-center">
                  <div className="playfair text-3xl font-bold text-[#F59E0B] mb-2">1M+</div>
                  <p className="text-sm text-[#C4B89A]">Orders Processed</p>
                </div>
                <div className="bg-[#1A1612] border border-[#F59E0B]/20 p-6 rounded-lg text-center">
                  <div className="playfair text-3xl font-bold text-[#F59E0B] mb-2">99.9%</div>
                  <p className="text-sm text-[#C4B89A]">Uptime</p>
                </div>
              </div>

              <div className="bg-[#1A1612] border-l-4 border-[#F59E0B] p-6 rounded">
                <p className="text-[#C4B89A] italic">
                  "We're on a mission to empower Indian restaurant owners with technology that actually works. No complexity. No headaches. Just smart tools that help you serve better."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-7xl mx-auto">
          <h2 className="playfair text-5xl font-bold text-center mb-16">Loved by Restaurant Owners</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: 'DineBoss ne humara order confusion bilkul khatam kar diya. Kitchen aur waiter ek hi system pe hain.',
                author: 'Ramesh Kumar',
                restaurant: 'Spice Garden Restaurant, Bangalore'
              },
              {
                quote: '3 months free mein hi laga ki ye toh bahut kaam ka hai. Ab paid plan pe hain aur bilkul satisfied.',
                author: 'Priya Sharma',
                restaurant: 'Café Aroma, Mumbai'
              },
              {
                quote: 'Analytics se pata chala ki evenings mein sabse zyada orders aate hain. Staff planning easy ho gayi.',
                author: 'Mohammed Asif',
                restaurant: 'The Biryani House, Hyderabad'
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-[#1A1612] border border-[#F59E0B]/20 p-8 rounded-xl">
                <p className="text-[#C4B89A] mb-6 italic">"{testimonial.quote}"</p>
                <p className="font-semibold mb-1">— {testimonial.author}</p>
                <p className="text-sm text-[#C4B89A]">{testimonial.restaurant}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-4xl mx-auto">
          <h2 className="playfair text-5xl font-bold text-center mb-16">Frequently Asked Questions</h2>

          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-[#1A1612] border border-[#F59E0B]/20 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full p-6 flex justify-between items-center hover:bg-[#1A1612]/80 transition"
                >
                  <span className="font-semibold text-left">{item.q}</span>
                  <ChevronDown className={`text-[#F59E0B] transition ${expandedFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {expandedFaq === i && (
                  <div className="px-6 pb-6 text-[#C4B89A] border-t border-[#F59E0B]/10">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TERMS SECTION */}
      <section id="terms" className="py-20 px-4 bg-[#0D0A06]">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="playfair text-5xl font-bold">Terms & Conditions</h2>
            <button
              onClick={() => setExpandedTerms(!expandedTerms)}
              className="text-[#F59E0B] hover:text-white transition"
            >
              {expandedTerms ? '▼' : '▶'}
            </button>
          </div>

          {expandedTerms && (
            <div className="bg-[#1A1612] border border-[#F59E0B]/20 p-8 rounded-xl whitespace-pre-wrap text-[#C4B89A] text-sm leading-relaxed max-h-96 overflow-y-auto">
              {termsContent}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0D0A06] border-t border-[#F59E0B]/10 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#F59E0B] rounded flex items-center justify-center">
                  <span>🍽️</span>
                </div>
                <span className="playfair text-xl font-bold text-[#F59E0B]">DineBoss</span>
              </div>
              <p className="text-sm text-[#C4B89A]">Built for Indian restaurants</p>
            </div>

            {[
              {
                title: 'Product',
                links: ['Features', 'Pricing', 'Security', 'Performance']
              },
              {
                title: 'Company',
                links: ['About', 'Blog', 'Careers', 'Contact']
              },
              {
                title: 'Support',
                links: ['Help Center', 'Contact Us', 'Documentation', 'Status']
              },
              {
                title: 'Legal',
                links: ['Terms & Conditions', 'Privacy Policy', 'Cookie Policy', 'GDPR']
              }
            ].map((col, i) => (
              <div key={i}>
                <h4 className="font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <button className="text-[#C4B89A] hover:text-[#F59E0B] transition text-sm">
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-[#F59E0B]/10 pt-8 text-center text-[#C4B89A] text-sm">
            <p className="mb-4">© 2025 DineBoss. All rights reserved. Made with ❤️ for Indian restaurants</p>
            <div className="flex justify-center gap-6">
              <button className="hover:text-[#F59E0B] transition">Twitter</button>
              <button className="hover:text-[#F59E0B] transition">Instagram</button>
              <button className="hover:text-[#F59E0B] transition">LinkedIn</button>
            </div>
          </div>
        </div>
      </footer>

      {/* VIDEO MODAL */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1A1612] border border-[#F59E0B] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-[#F59E0B]/20">
              <h3 className="playfair text-2xl font-bold text-[#F59E0B]">DineBoss Demo</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-[#C4B89A] hover:text-[#F59E0B] transition p-2 hover:bg-[#F59E0B]/10 rounded-lg"
                aria-label="Close video"
              >
                <X size={28} />
              </button>
            </div>

            {/* Video Container */}
            <div className="flex-1 flex items-center justify-center bg-black p-6 overflow-y-auto">
              <video
                width="100%"
                height="auto"
                controls
                autoPlay
                className="w-full h-auto rounded-lg"
                style={{ maxHeight: 'calc(90vh - 140px)' }}
              >
                <source src="/videofordemo.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-4 p-6 border-t border-[#F59E0B]/20">
              <button
                onClick={() => setShowVideoModal(false)}
                className="px-6 py-2 bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg font-semibold hover:bg-[#F59E0B]/20 transition"
              >
                Close
              </button>
              <Link
                href="/login"
                className="px-6 py-2 bg-[#F59E0B] text-[#0D0A06] rounded-lg font-semibold hover:bg-[#E59E0B] transition"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
