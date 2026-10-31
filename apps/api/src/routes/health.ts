import type { HealthResponse } from '@slamsort/shared';

export function health(): HealthResponse {
  return { status: 'ok', service: 'slamsort-api' };
}
