import type { ServiceIdentifier } from '../types';

export class CircularDependencyError extends Error {
  name = 'CircularDependencyError';

  constructor(path: ServiceIdentifier[]) {
    super(`Circular dependency detected: ${path.map(String).join(' -> ')}`);
  }
}
