import { ContainerDuplicatedError, DefaultContainerIdError } from '../errors';
import type { ContainerIdentifier } from '../types';
import { Container } from './container';

export class ContainerRegistry {
  private static defaultContainerInstance?: Container;

  private static readonly containerMap: Map<ContainerIdentifier, Container> = new Map();

  public static get defaultContainer(): Container {
    this.defaultContainerInstance ??= new Container('default');

    return this.defaultContainerInstance;
  }

  public static registerContainer(container: Container) {
    if (container.id === 'default') {
      throw new DefaultContainerIdError();
    }

    if (ContainerRegistry.containerMap.has(container.id)) {
      throw new ContainerDuplicatedError(container.id);
    }

    this.containerMap.set(container.id, container);
  }

  public static getContainer(id: ContainerIdentifier): Container | undefined {
    if (id === 'default') {
      return this.defaultContainer;
    }

    return this.containerMap.get(id);
  }

  public static hasContainer(id: ContainerIdentifier): boolean {
    if (id === 'default') {
      return true;
    }

    return this.containerMap.has(id);
  }

  public static removeContainer(id: ContainerIdentifier) {
    if (id === 'default') {
      throw new DefaultContainerIdError();
    }

    this.containerMap.delete(id);
  }
}
