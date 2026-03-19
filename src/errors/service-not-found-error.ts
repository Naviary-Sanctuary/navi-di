import type { ServiceIdentifier } from '../types';

export class ServiceNotFoundError extends Error {
  public name = 'ServiceNotFoundError';

  constructor(id: ServiceIdentifier) {
    super(`Service not found: ${String(id)}`);
  }
}
