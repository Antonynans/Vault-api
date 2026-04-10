import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * @FinancialEndpoint()
 * Applies strict rate limiting for money-movement endpoints.
 * 5 requests per 60 seconds — much tighter than the global 10/60s default.
 */
export function FinancialEndpoint(): MethodDecorator {
  return applyDecorators(Throttle({ default: { limit: 5, ttl: 60_000 } }));
}

/**
 * @AuthEndpoint()
 * Brute-force protection for login / register.
 * 10 attempts per 15 minutes per IP.
 */
export function AuthEndpoint(): MethodDecorator {
  return applyDecorators(
    Throttle({ default: { limit: 10, ttl: 15 * 60_000 } }),
  );
}

/**
 * @ReadEndpoint()
 * Relaxed limits for read-heavy GET endpoints.
 * 60 requests per 60 seconds.
 */
export function ReadEndpoint(): MethodDecorator {
  return applyDecorators(Throttle({ default: { limit: 60, ttl: 60_000 } }));
}
