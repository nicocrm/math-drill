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

export function jsonResponse(
  statusCode: number,
  data: unknown,
  extraHeaders?: Record<string, string>
): ScalewayResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}
