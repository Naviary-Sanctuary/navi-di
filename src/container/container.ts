import { CircularDependencyError, ServiceNotFoundError } from '../errors';
import type { ContainerIdentifier, Metadata, ServiceIdentifier } from '../types';
import { EMPTY_VALUE } from '../types';
import { ContainerRegistry } from './registry';

export class Container {
  public readonly id: ContainerIdentifier;

  private metadataMap: Map<ServiceIdentifier, Metadata> = new Map();
  private bindingMap: Map<ServiceIdentifier, unknown> = new Map();
  private resolving = new Set<ServiceIdentifier>();
  private resolvingPath: ServiceIdentifier[] = [];

  constructor(id: ContainerIdentifier) {
    this.id = id;
  }

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

  public has(id: ServiceIdentifier): boolean {
    return this.metadataMap.has(id);
  }

  public set<T>(id: ServiceIdentifier<T>, value: T) {
    this.bindingMap.set(id, value);
    return this;
  }

  public remove(id: ServiceIdentifier) {
    this.bindingMap.delete(id);
    this.metadataMap.delete(id);
    return this;
  }

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

  public get<T>(id: ServiceIdentifier<T>): T {
    if (this.bindingMap.has(id)) {
      return this.bindingMap.get(id) as T;
    }

    let metadata = this.metadataMap.get(id);

    if (!metadata && !this.isDefault()) {
      const defaultMetadata = ContainerRegistry.defaultContainer.metadataMap.get(id);

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
      const instance = new metadata.Class() as T;

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

  public static reset(containerId: ContainerIdentifier, options?: { strategy?: 'value' | 'service' }) {
    const container = ContainerRegistry.getContainer(containerId);

    container?.reset(options?.strategy);
  }
}
