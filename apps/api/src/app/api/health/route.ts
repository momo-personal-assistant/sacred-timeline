import { NextResponse } from 'next/server';

/**
 * Health check endpoint
 * Returns the operational status of the API and its dependencies
 */
export async function GET() {
  try {
    // TODO: Add Qdrant health check when db package is ready

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: 'pending', // Will be 'up' once Qdrant is connected
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
