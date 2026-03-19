import { ServiceNotFoundError } from '../errors';
import type { ContainerIdentifier, Metadata, ServiceIdentifier } from '../types';

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

    const instance = new metadata.Class() as T;

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
