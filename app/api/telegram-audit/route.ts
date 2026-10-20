import { NextResponse } from 'next/server';

/** Retired endpoint. GitBlast does not collect browser fingerprints or location data. */
export async function POST() {
  return NextResponse.json({ error: 'Endpoint retired.' }, { status: 404 });
}
