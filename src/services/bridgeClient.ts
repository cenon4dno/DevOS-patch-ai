/**
 * @file services/bridgeClient.ts
 * @satisfies [REQ-PAT-004], [REQ-PAT-005]
 * Thin wrapper around Bridge Agent relay endpoint.
 */

import fetch from 'node-fetch';
import logger from '../utils/logger';
import { BridgeRelayRequest, BridgeRelayResponse } from '../types';

const BRIDGE_URL = process.env.BRIDGE_AGENT_URL ?? 'http://localhost:3005';
const BRIDGE_KEY = process.env.BRIDGE_API_SUBSCRIPTION_KEY ?? '';

export class BridgeClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'BridgeClientError';
  }
}

export async function relayToBridge(
  payload: BridgeRelayRequest,
  traceId: string,
): Promise<string> {
  logger.info('Outbound request', {
    event: 'outbound_request',
    trace_id: traceId,
    target: 'bridge-agent',
    method: 'POST',
    path: '/api/v1/bridge/relay',
  });

  const startMs = Date.now();

  const response = await fetch(`${BRIDGE_URL}/api/v1/bridge/relay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': BRIDGE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const duration = Date.now() - startMs;

  if (!response.ok) {
    logger.error('Outbound request failed', {
      event: 'outbound_error',
      trace_id: traceId,
      target: 'bridge-agent',
      status_code: response.status,
      duration_ms: duration,
    });
    throw new BridgeClientError(
      `Bridge Agent returned ${response.status}`,
      'PATCH_BRIDGE_UNAVAILABLE',
    );
  }

  const body = (await response.json()) as BridgeRelayResponse;

  logger.info('Outbound response received', {
    event: 'outbound_response',
    trace_id: traceId,
    target: 'bridge-agent',
    status_code: response.status,
    duration_ms: duration,
  });

  if (body.status !== 'success' || !body.content) {
    throw new BridgeClientError(
      body.error?.message ?? 'Bridge Agent returned no content',
      body.error?.code ?? 'PATCH_BRIDGE_UNAVAILABLE',
    );
  }

  return body.content;
}
