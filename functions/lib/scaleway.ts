export interface ScalewayEvent {
  httpMethod: string;
  path: string;
  queryStringParameters: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

export interface ScalewayResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export type ScalewayHandler = (
  event: ScalewayEvent,
  context: unknown
) => Promise<ScalewayResponse>;

function corsHeaders(): Record<string, string> {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function jsonResponse(
  statusCode: number,
  data: unknown,
  extraHeaders?: Record<string, string>
): ScalewayResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

/** Handle OPTIONS preflight — call at the top of each handler. */
export function handleCorsPreflightMaybe(
  event: ScalewayEvent
): ScalewayResponse | null {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  return null;
}
