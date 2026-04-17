import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDNSInstructions } from "@/lib/domains";

/**
 * GET /api/domains/dns?restaurantId=...
 * Get DNS instructions for a restaurant's custom domain
 * 
 * Response:
 * {
 *   "success": true,
 *   "domain": "example.com",
 *   "dnsInstructions": {...},
 *   "isVerified": false
 * }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Missing restaurantId" },
        { status: 400 }
      );
    }

    // Get restaurant
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const restaurant = restaurantSnap.data();
    const customDomain = restaurant.customDomain;

    if (!customDomain) {
      return NextResponse.json(
        { error: "No custom domain configured" },
        { status: 400 }
      );
    }

    const dnsInstructions = getDNSInstructions(customDomain);

    return NextResponse.json({
      success: true,
      domain: customDomain,
      subdomain: restaurant.subdomain,
      dnsInstructions,
      isVerified: restaurant.domainVerified || false,
    });
  } catch (error) {
    console.error("Error getting DNS instructions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get DNS instructions" },
      { status: 500 }
    );
  }
}
