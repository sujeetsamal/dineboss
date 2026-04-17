import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { markDomainAsVerified } from "@/lib/domains";
import { isDomainVerified, VercelDomainError } from "@/lib/vercel-api";

/**
 * POST /api/domains/verify
 * Verify a custom domain that has been set up in DNS
 * 
 * Request:
 * {
 *   "restaurantId": "..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "domain": "example.com",
 *   "verified": true,
 *   "message": "Domain verified successfully!"
 * }
 */
export async function POST(request) {
  try {
    const { restaurantId } = await request.json();

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
        { error: "No custom domain configured for this restaurant" },
        { status: 400 }
      );
    }

    if (restaurant.domainVerified) {
      return NextResponse.json({
        success: true,
        domain: customDomain,
        verified: true,
        message: "Domain already verified",
      });
    }

    // Check verification status in Vercel
    let verified = false;
    try {
      verified = await isDomainVerified(customDomain);
    } catch (error) {
      if (error instanceof VercelDomainError && error.statusCode === 404) {
        // Domain not found in Vercel yet
        return NextResponse.json(
          {
            error: "Domain not ready in Vercel. Please wait a few minutes and try again.",
            verified: false,
          },
          { status: 202 }
        );
      }
      throw error;
    }

    if (!verified) {
      return NextResponse.json(
        {
          error: "Domain DNS not properly configured. Please check your DNS records and try again.",
          verified: false,
        },
        { status: 202 }
      );
    }

    // Mark as verified in Firebase
    await markDomainAsVerified(restaurantId);

    return NextResponse.json({
      success: true,
      domain: customDomain,
      verified: true,
      message: "Domain verified successfully!",
    });
  } catch (error) {
    console.error("Error verifying domain:", error);

    if (error instanceof VercelDomainError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.vercelError,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to verify domain" },
      { status: 500 }
    );
  }
}
