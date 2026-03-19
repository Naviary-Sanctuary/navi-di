import { ServiceNotFoundError } from '../errors';
import { EMPTY_VALUE, type ContainerIdentifier, type Metadata, type ServiceIdentifier } from '../types';

export class Container {
  public readonly id: ContainerIdentifier;

  private metadataMap: Map<ServiceIdentifier, Metadata> = new Map();

  constructor(id: ContainerIdentifier) {
    this.id = id;
  }

  public set<T>(metadata: Metadata<T>) {
    const newMetadata: Metadata<T> = {
      ...metadata,
    };

    const existingMetadata = this.metadataMap.get(newMetadata.id);

    if (existingMetadata) {
      Object.assign(existingMetadata, newMetadata);
    } else {
      this.metadataMap.set(newMetadata.id, newMetadata);
    }
  }

  public reset() {
    this.metadataMap.clear();
  }

  public get<T>(id: ServiceIdentifier<T>): T {
    const metadata = this.metadataMap.get(id);

    if (!metadata) {
      throw new ServiceNotFoundError(id);
    }

    if (metadata.value !== EMPTY_VALUE) {
      return metadata.value as T;
    }

    const instance = new metadata.Class() as T;

    if (metadata.scope !== 'transient') {
      metadata.value = instance;
    }

    for (const injection of metadata.injections) {
      Object.defineProperty(instance, injection.name, {
        value: this.get(injection.id),
        writable: true,
        configurable: true,
      });
    }

    return instance;
  }
}
