import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getRestaurantBySubdomain, getRestaurantByCustomDomain } from '@/lib/domains';

/**
 * GET /api/restaurants/[id]
 * Get basic restaurant data (public info)
 */
export async function GET(request, { params }) {
  try {
    const restaurantId = params.id;

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Missing restaurant ID' },
        { status: 400 }
      );
    }

    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    const restaurant = restaurantSnap.data();

    // Return public restaurant data only
    return NextResponse.json({
      id: restaurantId,
      name: restaurant.name,
      subdomain: restaurant.subdomain,
      customDomain: restaurant.customDomain,
      domainVerified: restaurant.domainVerified,
      theme: restaurant.theme || 'light',
      logo: restaurant.logo || null,
      description: restaurant.description || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      hours: restaurant.hours || {},
      acceptingOrders: restaurant.acceptingOrders !== false,
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restaurant' },
      { status: 500 }
    );
  }
}
