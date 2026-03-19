import type { ContainerIdentifier } from '../types';

export class ContainerDuplicatedError extends Error {
  public name = 'ContainerDuplicatedError';

  constructor(id: ContainerIdentifier) {
    super(`Cannot register container with same ID(${String(id)})`);
  }
}
