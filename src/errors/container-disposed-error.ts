import type { ContainerIdentifier } from '../types';

/**
 * Thrown when an operation is attempted on a disposed container instance.
 */
export class ContainerDisposedError extends Error {
  public name = 'ContainerDisposedError';

  /**
   * @param id The identifier of the disposed container.
   */
  constructor(id: ContainerIdentifier) {
    super(`Container has been disposed: ${String(id)}`);
  }
}
