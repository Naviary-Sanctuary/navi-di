/**
 * Thrown when code attempts to use the reserved `default` identifier for a named container operation.
 *
 * @internal
 */
export class DefaultContainerIdError extends Error {
  public name = 'DefaultContainerIdError';

  constructor() {
    super('The `default` identifier is reserved for the default container.');
  }
}
