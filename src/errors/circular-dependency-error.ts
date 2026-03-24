import type { ServiceIdentifier } from '../types';

/**
 * Thrown when service resolution detects a circular dependency path.
 *
 * @internal
 */
export class CircularDependencyError extends Error {
  name = 'CircularDependencyError';

  /**
   * @param path The dependency chain that produced the circular reference.
   */
  constructor(path: ServiceIdentifier[]) {
    super(`Circular dependency detected: ${path.map(String).join(' -> ')}`);
  }
}
