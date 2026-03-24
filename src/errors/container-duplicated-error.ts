import type { ContainerIdentifier } from '../types';

/**
 * Thrown when a named container is registered with an identifier that already exists.
 *
 * @internal
 */
export class ContainerDuplicatedError extends Error {
  public name = 'ContainerDuplicatedError';

  /**
   * @param id The duplicated container identifier.
   */
  constructor(id: ContainerIdentifier) {
    super(`Cannot register container with same ID(${String(id)})`);
  }
}
