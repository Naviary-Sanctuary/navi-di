import { ContainerDuplicatedError, DefaultContainerIdError } from '../errors';
import type { ContainerIdentifier } from '../types';
import { Container } from './container';

export class ContainerRegistry {
  public static readonly defaultContainer: Container = new Container('default');

  private static readonly containerMap: Map<ContainerIdentifier, Container> = new Map();

  public static registerContainer(container: Container) {
    if (container.id === 'default') {
      throw new DefaultContainerIdError();
    }

    if (ContainerRegistry.containerMap.has(container.id)) {
      throw new ContainerDuplicatedError(container.id);
    }

    this.containerMap.set(container.id, container);
  }
}
