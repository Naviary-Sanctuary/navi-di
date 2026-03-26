import { ContainerDuplicatedError, DefaultContainerIdError } from '../errors';
import type { ContainerIdentifier } from '../types';
import { Container } from './container';

/**
 * Stores the default container and all named containers.
 *
 * This registry is the shared source of truth behind `Container.of()` and
 * decorator-based service registration.
 *
 * @internal
 */
export class ContainerRegistry {
  private static defaultContainerInstance?: Container;

  private static readonly containerMap: Map<ContainerIdentifier, Container> = new Map();

  /**
   * Returns the canonical default container instance.
   *
   * The default container is created lazily the first time it is requested.
   */
  public static get defaultContainer(): Container {
    this.defaultContainerInstance ??= new Container('default');

    return this.defaultContainerInstance;
  }

  /**
   * Registers a named container in the shared registry.
   *
   * @param container The container to register.
   * @throws {DefaultContainerIdError} If the container uses the reserved `default` id.
   * @throws {ContainerDuplicatedError} If another container already uses the same id.
   */
  public static registerContainer(container: Container) {
    if (container.id === 'default') {
      throw new DefaultContainerIdError();
    }

    if (ContainerRegistry.containerMap.has(container.id)) {
      throw new ContainerDuplicatedError(container.id);
    }

    this.containerMap.set(container.id, container);
  }

  /**
   * Returns the default container or a named container by identifier.
   *
   * @param id The container identifier to resolve.
   * @returns The default container for `'default'`, or the matching named container if one exists.
   */
  public static getContainer(id: ContainerIdentifier): Container | undefined {
    if (id === 'default') {
      return this.defaultContainer;
    }

    return this.containerMap.get(id);
  }

  /**
   * Returns whether a container exists for the given identifier.
   *
   * The reserved `default` identifier is always treated as present.
   *
   * @param id The container identifier to check.
   * @returns `true` when the container exists in the registry.
   */
  public static hasContainer(id: ContainerIdentifier): boolean {
    if (id === 'default') {
      return true;
    }

    return this.containerMap.has(id);
  }

  /**
   * Removes a named container from the registry.
   *
   * @param id The named container identifier to remove.
   * @throws {DefaultContainerIdError} If the reserved `default` id is used.
   */
  public static removeContainer(id: ContainerIdentifier) {
    if (id === 'default') {
      throw new DefaultContainerIdError();
    }

    this.containerMap.delete(id);
  }

  public static disposeContainer(container: Container) {
    if (container.id === 'default') {
      if (this.defaultContainerInstance === container) {
        this.defaultContainerInstance = undefined;
      }

      return;
    }

    if (this.containerMap.get(container.id) === container) {
      this.containerMap.delete(container.id);
    }
  }
}
