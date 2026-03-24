import type { ServiceIdentifier } from '../types';

/**
 * Thrown when a service cannot be resolved for the requested identifier.
 *
 * @internal
 */
export class ServiceNotFoundError extends Error {
  public name = 'ServiceNotFoundError';

  /**
   * @param id The service identifier that could not be resolved.
   */
  constructor(id: ServiceIdentifier) {
    super(`Service not found: ${String(id)}`);
  }
}
