import { CircularDependencyError, ServiceNotFoundError } from '../errors';
import type {
  ClassProvider,
  ContainerIdentifier,
  FactoryProvider,
  Metadata,
  ServiceIdentifier,
  ServiceProvider,
  ValueProvider,
} from '../types';
import { EMPTY_VALUE } from '../types';
import { ContainerRegistry } from './registry';

/**
 * Resolves services and stores container-local bindings.
 *
 * Containers let you resolve registered services, override values for the
 * current context, and isolate container-scoped services by container.
 */
export class Container {
  /**
   * The identifier of this container.
   *
   * The default container uses `'default'`, and named containers use the
   * identifier they were created with.
   */
  public readonly id: ContainerIdentifier;

  private metadataMap: Map<ServiceIdentifier, Metadata> = new Map();
  private bindingMap: Map<ServiceIdentifier, unknown> = new Map();
  private resolving = new Set<ServiceIdentifier>();
  private resolvingPath: ServiceIdentifier[] = [];

  constructor(id: ContainerIdentifier) {
    this.id = id;
  }

  private isValueProvider<T>(provider: T | ServiceProvider<T>): provider is ValueProvider<T> {
    return typeof provider === 'object' && provider !== null && 'useValue' in provider;
  }

  private isClassProvider<T>(provider: T | ServiceProvider<T>): provider is ClassProvider<T> {
    return typeof provider === 'object' && provider !== null && 'useClass' in provider;
  }

  private isFactoryProvider<T>(provider: T | ServiceProvider<T>): provider is FactoryProvider<T> {
    return typeof provider === 'object' && provider !== null && 'useFactory' in provider;
  }

  private getClassProviderMetadata<T>(id: ServiceIdentifier<T>, provider: ClassProvider<T>): Metadata<T> {
    const existingMetadata =
      this.metadataMap.get(provider.useClass) ?? ContainerRegistry.defaultContainer.metadataMap.get(provider.useClass);
    const inheritedInjections = existingMetadata?.Class === provider.useClass ? [...existingMetadata.injections] : [];
    const inheritedScope = existingMetadata?.Class === provider.useClass ? existingMetadata.scope : 'container';

    return {
      id,
      Class: provider.useClass,
      name: provider.useClass.name || String(id),
      injections: provider.injections ?? inheritedInjections,
      scope: provider.scope ?? inheritedScope,
      value: EMPTY_VALUE,
    };
  }

  private getFactoryProviderMetadata<T>(id: ServiceIdentifier<T>, provider: FactoryProvider<T>): Metadata<T> {
    return {
      id,
      name: typeof id === 'function' ? id.name : String(id),
      injections: [],
      scope: provider.scope ?? 'container',
      value: EMPTY_VALUE,
      factory: provider.useFactory,
    };
  }

  /**
   * Returns the default container or a named container.
   *
   * Calling this method with the same identifier always returns the same
   * container instance.
   *
   * @param id The container identifier. Omit this to use the default container.
   * @returns The matching container instance.
   */
  public static of(id: ContainerIdentifier = 'default') {
    if (id === 'default') {
      return ContainerRegistry.defaultContainer;
    }

    if (ContainerRegistry.hasContainer(id)) {
      return ContainerRegistry.getContainer(id)!;
    }

    const container = new Container(id);

    ContainerRegistry.registerContainer(container);

    return container;
  }

  /**
   * Registers service metadata in this container.
   *
   * This is a low-level API for manual registration when you are not using
   * `@Service()`. Registering a `singleton` on a named container stores it in
   * the default container so it can be shared across containers.
   *
   * @param metadata The service metadata to register.
   * @returns The current container.
   */
  public register<T>(metadata: Metadata<T>) {
    if (metadata.scope === 'singleton' && !this.isDefault()) {
      ContainerRegistry.defaultContainer.register(metadata);
      this.metadataMap.delete(metadata.id);
      return this;
    }

    const newMetadata: Metadata<T> = {
      ...metadata,
    };

    const existingMetadata = this.metadataMap.get(newMetadata.id);

    if (existingMetadata) {
      Object.assign(existingMetadata, newMetadata);
    } else {
      this.metadataMap.set(newMetadata.id, newMetadata);
    }

    return this;
  }

  /**
   * Returns whether this container has a local registration for an identifier.
   *
   * This only checks registrations stored on the current container and does
   * not indicate whether the identifier can be resolved through fallback.
   *
   * @param id The service identifier to check.
   * @returns `true` when the current container has a local registration.
   */
  public has(id: ServiceIdentifier): boolean {
    return this.metadataMap.has(id);
  }

  /**
   * Registers a value or provider for a service identifier.
   *
   * Use a plain value to bind an explicit instance, or a provider object to
   * resolve by class or factory.
   *
   * @param id The service identifier to register.
   * @param valueOrProvider The bound value or provider definition.
   * @returns The current container.
   */
  public set<T>(id: ServiceIdentifier<T>, value: T): this;
  public set<T>(id: ServiceIdentifier<T>, provider: ServiceProvider<T>): this;
  public set<T>(id: ServiceIdentifier<T>, valueOrProvider: T | ServiceProvider<T>) {
    if (this.isValueProvider(valueOrProvider)) {
      this.bindingMap.set(id, valueOrProvider.useValue);
      this.metadataMap.delete(id);
      return this;
    }

    if (this.isClassProvider(valueOrProvider)) {
      this.bindingMap.delete(id);
      return this.register(this.getClassProviderMetadata(id, valueOrProvider));
    }

    if (this.isFactoryProvider(valueOrProvider)) {
      this.bindingMap.delete(id);
      return this.register(this.getFactoryProviderMetadata(id, valueOrProvider));
    }

    this.bindingMap.set(id, valueOrProvider);
    this.metadataMap.delete(id);
    return this;
  }

  /**
   * Removes a local binding or registration from this container.
   *
   * @param id The service identifier to remove.
   * @returns The current container.
   */
  public remove(id: ServiceIdentifier) {
    this.bindingMap.delete(id);
    this.metadataMap.delete(id);
    return this;
  }

  /**
   * Resets services stored in this container.
   *
   * Use `'value'` to clear cached instances while keeping registrations, or
   * `'service'` to remove local registrations and bindings entirely.
   *
   * @param strategy The reset strategy to apply.
   * @returns The current container.
   */
  public reset(strategy: 'value' | 'service' = 'value') {
    if (strategy === 'value') {
      this.metadataMap.forEach((metadata) => {
        metadata.value = EMPTY_VALUE;
      });

      return this;
    } else {
      this.bindingMap.clear();
      this.metadataMap.clear();

      return this;
    }
  }

  /**
   * Resolves a service from this container.
   *
   * If the current container does not have a local registration, named
   * containers can continue resolution through the default container according
   * to the service scope. Services are instantiated with `new Class()` and do
   * not support constructor arguments.
   *
   * @param id The service identifier to resolve.
   * @returns The resolved service instance or bound value.
   * @throws {ServiceNotFoundError} If no service is registered for the identifier.
   * @throws {CircularDependencyError} If the dependency graph contains a cycle.
   */
  public get<T>(id: ServiceIdentifier<T>): T {
    if (this.bindingMap.has(id)) {
      return this.bindingMap.get(id) as T;
    }

    let metadata = this.metadataMap.get(id) as Metadata<T> | undefined;

    if (!metadata && !this.isDefault()) {
      const defaultMetadata = ContainerRegistry.defaultContainer.metadataMap.get(id) as Metadata<T> | undefined;

      if (!defaultMetadata) {
        throw new ServiceNotFoundError(id);
      }

      if (defaultMetadata.scope === 'singleton') {
        return ContainerRegistry.defaultContainer.get(id);
      }

      if (defaultMetadata.scope === 'container') {
        metadata = {
          ...defaultMetadata,
          injections: [...defaultMetadata.injections],
          value: EMPTY_VALUE,
        };

        this.metadataMap.set(id, metadata);
      } else {
        metadata = defaultMetadata;
      }
    }

    if (!metadata) {
      throw new ServiceNotFoundError(id);
    }

    if (metadata.scope !== 'transient' && metadata.value !== EMPTY_VALUE) {
      return metadata.value as T;
    }

    if (this.resolving.has(id)) {
      throw new CircularDependencyError([...this.resolvingPath, id]);
    }

    this.resolving.add(id);
    this.resolvingPath.push(id);

    try {
      const instance: T = metadata.factory ? metadata.factory(this) : new metadata.Class!();

      for (const injection of metadata.injections) {
        Object.defineProperty(instance, injection.name, {
          value: this.get(injection.id),
          writable: true,
          configurable: true,
        });
      }

      if (metadata.scope !== 'transient') {
        metadata.value = instance;
      }

      return instance;
    } finally {
      this.resolving.delete(id);
      this.resolvingPath.pop();
    }
  }

  private isDefault() {
    return this === ContainerRegistry.defaultContainer;
  }

  /**
   * Resets a container by its identifier.
   *
   * @param containerId The container to reset.
   * @param options Reset options.
   */
  public static reset(containerId: ContainerIdentifier, options?: { strategy?: 'value' | 'service' }) {
    const container = ContainerRegistry.getContainer(containerId);

    container?.reset(options?.strategy);
  }
}
