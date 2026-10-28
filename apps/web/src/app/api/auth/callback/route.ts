import { NextResponse } from "next/server";
import { backend } from "@/lib/server";

export async function GET(request: Request) {
  const destination = await backend.accountCallback(request);
  return NextResponse.redirect(destination, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
