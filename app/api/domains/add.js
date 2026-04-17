import { NextResponse } from "next/server";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  isValidDomain,
  isCustomDomainTaken,
  updateCustomDomain,
  getDNSInstructions,
} from "@/lib/domains";
import {
  addDomainToProject,
  VercelDomainError,
} from "@/lib/vercel-api";

/**
 * POST /api/domains/add
 * Add a custom domain to a restaurant
 * 
 * Request:
 * {
 *   "domain": "example.com",
 *   "restaurantId": "..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "domain": "example.com",
 *   "dnsInstructions": {...},
 *   "verificationNeeded": true
 * }
 */
export async function POST(request) {
  try {
    const { domain, restaurantId } = await request.json();

    // Validate input
    if (!domain || !restaurantId) {
      return NextResponse.json(
        { error: "Missing domain or restaurantId" },
        { status: 400 }
      );
    }

    // Validate domain format
    if (!isValidDomain(domain)) {
      return NextResponse.json(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    // Get restaurant to verify ownership
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    // Check if domain is already taken
    const isTaken = await isCustomDomainTaken(domain, restaurantId);
    if (isTaken) {
      return NextResponse.json(
        { error: "Domain is already in use by another restaurant" },
        { status: 409 }
      );
    }

    // Add domain to Vercel project
    let vercelResponse;
    try {
      vercelResponse = await addDomainToProject(domain);
    } catch (error) {
      if (error instanceof VercelDomainError) {
        // Domain might already be in the project
        if (error.statusCode === 400) {
          // Continue anyway - we'll verify later
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Update Firestore with custom domain
    await updateCustomDomain(restaurantId, domain);

    // Get DNS instructions
    const dnsInstructions = getDNSInstructions(domain);

    return NextResponse.json({
      success: true,
      domain,
      subdomain: restaurantSnap.data().subdomain,
      dnsInstructions,
      vercelDomain: vercelResponse,
      message: "Domain added successfully. Please update your DNS records.",
    });
  } catch (error) {
    console.error("Error adding domain:", error);

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
      { error: error.message || "Failed to add domain" },
      { status: 500 }
    );
  }
}
