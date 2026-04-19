import { getRestaurantBySubdomain } from '@/lib/domains';
import { getRestaurant } from '@/lib/firestore';
import { notFound } from 'next/navigation';
import PublicMenuPage from '@/components/PublicMenuPage';

/**
 * Dynamic restaurant route
 * Handles: abc.dineboss.app → /restaurant/abc
 *          example.com → /restaurant/example.com
 * 
 * This is the public-facing menu page for restaurants
 */

export const dynamicParams = true;
export const revalidate = 0; // CRITICAL: Disable ISR to avoid caching failures

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const restaurant = await getRestaurantBySubdomain(slug);
    if (!restaurant) {
      return { title: 'Restaurant Not Found' };
    }

    return {
      title: `${restaurant.name} - Menu | DineBoss`,
      description: `Order from ${restaurant.name} using DineBoss.`,
      openGraph: {
        title: `${restaurant.name} - Menu`,
        description: `Order from ${restaurant.name}`,
      },
    };
  } catch {
    return { title: 'Restaurant Not Found' };
  }
}

export default async function RestaurantRoutePage({ params }) {
  const { slug } = await params;

  try {
    // Look up restaurant by subdomain - simple and direct
    const restaurant = await getRestaurantBySubdomain(slug);

    if (!restaurant) {
      console.error('[RESTAURANT PAGE] ✗ No restaurant found for subdomain:', slug);
      notFound();
    }

    const restaurantId = restaurant.id;
    
    const fullRestaurant = await getRestaurant(restaurantId);

    if (!fullRestaurant) {
      console.error('[RESTAURANT PAGE] ✗ Could not fetch restaurant data');
      notFound();
    }

    return (
      <PublicMenuPage 
        restaurantId={restaurant.id}
        restaurant={fullRestaurant}
        slug={slug}
      />
    );
  } catch (error) {
    console.error('[RESTAURANT PAGE] ✗ Error:', error.message);
    notFound();
  }
}
