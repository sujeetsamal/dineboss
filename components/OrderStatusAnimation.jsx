'use client';

import { motion } from 'framer-motion';

// Animated icon for order received
export const OrderReceivedAnimation = () => (
  <motion.div className="flex flex-col items-center justify-center py-8">
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border-4 border-green-400 bg-green-400/10"
    >
      <motion.svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <motion.path
          d="M40 10C24.5 10 12 22.5 12 38C12 53.5 24.5 66 40 66C55.5 66 68 53.5 68 38C68 22.5 55.5 10 40 10Z"
          stroke="#4ade80"
          strokeWidth="3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5 }}
          fill="none"
        />
        <motion.path
          d="M28 38L36 46L52 30"
          stroke="#4ade80"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          fill="none"
        />
      </motion.svg>
    </motion.div>
    <h2 className="text-center font-display text-2xl text-green-300">Your order has been received</h2>
    <p className="mt-2 text-center text-sm text-slate-300">Our kitchen has started preparing your delicious meal!</p>
  </motion.div>
);

// Animated cooking icon
export const CookingAnimation = () => (
  <motion.div className="flex flex-col items-center justify-center py-8">
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border-4 border-orange-400 bg-orange-400/10"
    >
      <motion.svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pot */}
        <path
          d="M20 50H60C62 50 63 51 63 53V60C63 62 62 63 60 63H20C18 63 17 62 17 60V53C17 51 18 50 20 50Z"
          stroke="#fb923c"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Handle left */}
        <path d="M17 56H12" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
        {/* Handle right */}
        <path d="M63 56H68" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
        
        {/* Animated steam bubbles */}
        <motion.circle
          cx="30"
          cy="42"
          r="3"
          fill="#fb923c"
          animate={{ y: [0, -15, -20], opacity: [1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0 }}
        />
        <motion.circle
          cx="40"
          cy="42"
          r="3"
          fill="#fb923c"
          animate={{ y: [0, -15, -20], opacity: [1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
        />
        <motion.circle
          cx="50"
          cy="42"
          r="3"
          fill="#fb923c"
          animate={{ y: [0, -15, -20], opacity: [1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.8 }}
        />
      </motion.svg>
    </motion.div>
    <h2 className="text-center font-display text-2xl text-orange-300">Your food is being prepared</h2>
    <p className="mt-2 text-center text-sm text-slate-300">Our chefs are working their magic in the kitchen!</p>
  </motion.div>
);

// Animated served icon
export const ServedAnimation = () => (
  <motion.div className="flex flex-col items-center justify-center py-8">
    <motion.div
      animate={{ rotate: [0, 10, -10, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border-4 border-yellow-400 bg-yellow-400/10"
    >
      <motion.svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Plate */}
        <circle cx="40" cy="40" r="30" stroke="#facc15" strokeWidth="3" fill="none" />
        <circle cx="40" cy="40" r="26" stroke="#facc15" strokeWidth="1" opacity="0.5" fill="none" />
        
        {/* Food items on plate */}
        <motion.ellipse
          cx="32"
          cy="35"
          rx="8"
          ry="10"
          fill="#facc15"
          opacity="0.7"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.ellipse
          cx="48"
          cy="35"
          rx="8"
          ry="10"
          fill="#facc15"
          opacity="0.7"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        />
        <motion.ellipse
          cx="40"
          cy="50"
          rx="10"
          ry="8"
          fill="#facc15"
          opacity="0.7"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
        />
      </motion.svg>
    </motion.div>
    <h2 className="text-center font-display text-2xl text-yellow-300">Your meal is served!</h2>
    <p className="mt-2 text-center text-sm text-slate-300">🍽️ Enjoy your delicious meal! Bon appétit!</p>
  </motion.div>
);

// Animated payment/completion icon
export const PaymentAnimation = ({ paymentQRUrl }) => (
  <motion.div className="flex flex-col items-center justify-center py-8">
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border-4 border-purple-400 bg-purple-400/10"
    >
      <motion.svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Credit card */}
        <rect x="15" y="25" width="50" height="35" rx="4" stroke="#c084fc" strokeWidth="3" fill="none" />
        {/* Chip */}
        <rect x="20" y="35" width="8" height="8" stroke="#c084fc" strokeWidth="2" fill="none" />
        {/* Magnetic stripe */}
        <line x1="25" y1="52" x2="65" y2="52" stroke="#c084fc" strokeWidth="2" opacity="0.5" />
        <line x1="25" y1="56" x2="65" y2="56" stroke="#c084fc" strokeWidth="1" opacity="0.3" />
        
        {/* Checkmark */}
        <motion.g animate={{ scale: [0, 1, 1] }} transition={{ duration: 0.6, delay: 0.3 }}>
          <circle cx="60" cy="20" r="12" fill="#c084fc" opacity="0.8" />
          <path
            d="M55 20L58 23L65 16"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </motion.g>
      </motion.svg>
    </motion.div>
    <h2 className="text-center font-display text-2xl text-purple-300">Ready for payment</h2>
    <p className="mt-2 text-center text-sm text-slate-300">Please proceed to the counter or use the payment QR code</p>
    
    {/* Payment QR Display */}
    {paymentQRUrl && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 rounded-xl border border-purple-400/30 bg-purple-400/5 p-4"
      >
        <p className="text-xs font-semibold text-purple-300 mb-3 text-center uppercase tracking-wide">Scan to pay via UPI</p>
        <motion.img
          src={paymentQRUrl}
          alt="Payment QR Code"
          className="h-40 w-40 rounded-lg border border-purple-400/50 bg-white p-2"
          whileHover={{ scale: 1.05 }}
        />
      </motion.div>
    )}
  </motion.div>
);

// Main component that selects which animation to show
export default function OrderStatusAnimation({ status, paymentQRUrl }) {
  switch (status) {
    case 'pending':
      return <OrderReceivedAnimation />;
    case 'preparing':
      return <CookingAnimation />;
    case 'served':
      return <ServedAnimation />;
    case 'completed':
      return <PaymentAnimation paymentQRUrl={paymentQRUrl} />;
    default:
      return null;
  }
}
