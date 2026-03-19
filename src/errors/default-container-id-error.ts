export class DefaultContainerIdError extends Error {
  public name = 'DefaultContainerIdError';

  constructor() {
    super(`You cannot register a container with the "default" for ID`);
  }
}
