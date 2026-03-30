import { CircularDependencyError, ContainerDisposedError, ServiceNotFoundError } from '../errors';
import type {
  ClassProvider,
  ContainerIdentifier,
  FactoryProvider,
  InjectionMetadata,
  Metadata,
  ServiceIdentifier,
  ServiceProvider,
  ValueProvider,
} from '../types';
import { EMPTY_VALUE } from '../types';
import { ContainerRegistry } from './registry';

export class Container {
  public readonly id: ContainerIdentifier;

  private parentContainer?: Container;

  private readonly children = new Set<Container>();

  private metadataMap: Map<ServiceIdentifier, Metadata> = new Map();

  private bindingMap: Map<ServiceIdentifier, unknown> = new Map();

  private multiMetadataMap: Map<ServiceIdentifier, Metadata[]> = new Map();

  private multiBindingMap: Map<ServiceIdentifier, unknown[]> = new Map();

  private inheritedMultiMetadataMap: Map<ServiceIdentifier, Map<Metadata, Metadata>> = new Map();

  private resolving = new Set<Metadata>();

  private resolvingPath: ServiceIdentifier[] = [];

  private disposed = false;

  constructor(id: ContainerIdentifier, parent?: Container) {
    this.id = id;
    this.parentContainer = parent;
    parent?.children.add(this);
  }

  public get parent(): Container | undefined {
    return this.parentContainer;
  }

  private ensureNotDisposed() {
    if (this.disposed) {
      throw new ContainerDisposedError(this.id);
    }
  }

  private isDisposable(value: unknown): value is { dispose: () => void | Promise<void> } {
    return typeof value === 'object' && value !== null && 'dispose' in value && typeof value.dispose === 'function';
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

  private isRoot() {
    return this.parentContainer === undefined;
  }

  private getRoot(): Container {
    return this.parentContainer?.getRoot() ?? this;
  }

  private getLineage(): Container[] {
    return this.parentContainer ? [...this.parentContainer.getLineage(), this] : [this];
  }

  private cloneMetadata<T>(metadata: Metadata<T>): Metadata<T> {
    return {
      ...metadata,
      injections: [...metadata.injections],
      value: EMPTY_VALUE,
    };
  }

  private findBindingOwner(id: ServiceIdentifier): Container | undefined {
    if (this.bindingMap.has(id)) {
      return this;
    }

    return this.parentContainer?.findBindingOwner(id);
  }

  private findMetadataOwner(id: ServiceIdentifier): Container | undefined {
    if (this.metadataMap.has(id)) {
      return this;
    }

    return this.parentContainer?.findMetadataOwner(id);
  }

  private canResolve(id: ServiceIdentifier): boolean {
    return this.findBindingOwner(id) !== undefined || this.findMetadataOwner(id) !== undefined;
  }

  private getClassProviderMetadata<T>(
    id: ServiceIdentifier<T>,
    provider: ClassProvider<T>,
    multiple = false,
  ): Metadata<T> {
    const existingMetadata = this.findMetadataOwner(provider.useClass)?.metadataMap.get(provider.useClass) as
      | Metadata<T>
      | undefined;
    const inheritedInjections = existingMetadata?.Class === provider.useClass ? [...existingMetadata.injections] : [];
    const inheritedScope = existingMetadata?.Class === provider.useClass ? existingMetadata.scope : 'container';

    return {
      id,
      Class: provider.useClass,
      name: provider.useClass.name || String(id),
      injections: provider.injections ?? inheritedInjections,
      scope: provider.scope ?? inheritedScope,
      value: EMPTY_VALUE,
      multiple,
    };
  }

  private getFactoryProviderMetadata<T>(
    id: ServiceIdentifier<T>,
    provider: FactoryProvider<T>,
    multiple = false,
  ): Metadata<T> {
    return {
      id,
      name: typeof id === 'function' ? id.name : String(id),
      injections: [],
      scope: provider.scope ?? 'container',
      value: EMPTY_VALUE,
      factory: provider.useFactory,
      multiple,
    };
  }

  private pushMultiBinding<T>(id: ServiceIdentifier<T>, value: T) {
    const bindings = this.multiBindingMap.get(id) ?? [];

    bindings.push(value);
    this.multiBindingMap.set(id, bindings);
  }

  private pushMultiMetadata<T>(id: ServiceIdentifier<T>, metadata: Metadata<T>) {
    const registrations = this.multiMetadataMap.get(id) ?? [];

    registrations.push(metadata);
    this.multiMetadataMap.set(id, registrations);
  }

  private getOrCreateInheritedMultiMetadata<T>(id: ServiceIdentifier<T>, sourceMetadata: Metadata<T>): Metadata<T> {
    let inheritedRegistrations = this.inheritedMultiMetadataMap.get(id);

    if (!inheritedRegistrations) {
      inheritedRegistrations = new Map();
      this.inheritedMultiMetadataMap.set(id, inheritedRegistrations);
    }

    const existingMetadata = inheritedRegistrations.get(sourceMetadata) as Metadata<T> | undefined;

    if (existingMetadata) {
      return existingMetadata;
    }

    const metadata = this.cloneMetadata(sourceMetadata);

    inheritedRegistrations.set(sourceMetadata, metadata);

    return metadata;
  }

  private defineInjection(instance: object, injection: InjectionMetadata) {
    const value = injection.multiple ? this.getMany(injection.id) : this.get(injection.id);

    Object.defineProperty(instance, injection.name, {
      value,
      writable: true,
      configurable: true,
    });
  }

  private resolveMetadata<T>(metadata: Metadata<T>, resolutionContainer: Container): T {
    if (metadata.scope !== 'transient' && metadata.value !== EMPTY_VALUE) {
      return metadata.value as T;
    }

    if (resolutionContainer.resolving.has(metadata)) {
      throw new CircularDependencyError([...resolutionContainer.resolvingPath, metadata.id]);
    }

    resolutionContainer.resolving.add(metadata);
    resolutionContainer.resolvingPath.push(metadata.id);

    try {
      const instance: T = metadata.factory ? metadata.factory(resolutionContainer) : new metadata.Class!();

      for (const injection of metadata.injections) {
        this.defineInjection(instance as object, injection);
      }

      if (metadata.scope !== 'transient') {
        metadata.value = instance;
      }

      return instance;
    } finally {
      resolutionContainer.resolving.delete(metadata);
      resolutionContainer.resolvingPath.pop();
    }
  }

  private resetMetadataValues() {
    this.metadataMap.forEach((metadata) => {
      metadata.value = EMPTY_VALUE;
    });

    this.multiMetadataMap.forEach((registrations) => {
      registrations.forEach((metadata) => {
        metadata.value = EMPTY_VALUE;
      });
    });

    this.inheritedMultiMetadataMap.forEach((registrations) => {
      registrations.forEach((metadata) => {
        metadata.value = EMPTY_VALUE;
      });
    });
  }

  private collectOwnedValues(): Set<unknown> {
    const ownedValues = new Set<unknown>();

    this.bindingMap.forEach((value) => {
      ownedValues.add(value);
    });

    this.multiBindingMap.forEach((values) => {
      values.forEach((value) => {
        ownedValues.add(value);
      });
    });

    this.metadataMap.forEach((metadata) => {
      if (metadata.value !== EMPTY_VALUE) {
        ownedValues.add(metadata.value);
      }
    });

    this.multiMetadataMap.forEach((registrations) => {
      registrations.forEach((metadata) => {
        if (metadata.value !== EMPTY_VALUE) {
          ownedValues.add(metadata.value);
        }
      });
    });

    this.inheritedMultiMetadataMap.forEach((registrations) => {
      registrations.forEach((metadata) => {
        if (metadata.value !== EMPTY_VALUE) {
          ownedValues.add(metadata.value);
        }
      });
    });

    return ownedValues;
  }

  public unlinkParent() {
    this.parentContainer?.children.delete(this);
    this.parentContainer = undefined;
  }

  public hasParent(parent: Container | undefined): boolean {
    return this.parentContainer === parent;
  }

  public static of(id: ContainerIdentifier = 'default') {
    if (id === 'default') {
      return ContainerRegistry.defaultContainer;
    }

    if (ContainerRegistry.hasContainer(id)) {
      return ContainerRegistry.getContainer(id)!;
    }

    const container = new Container(id, ContainerRegistry.defaultContainer);

    ContainerRegistry.registerContainer(container);

    return container;
  }

  public static ofChild(id: ContainerIdentifier, parent: Container | ContainerIdentifier = 'default') {
    const parentContainer = parent instanceof Container ? parent : Container.of(parent);

    if (id === 'default') {
      return ContainerRegistry.defaultContainer;
    }

    const existingContainer = ContainerRegistry.getContainer(id);

    if (existingContainer) {
      if (!existingContainer.hasParent(parentContainer)) {
        throw new Error(`Container already exists with a different parent: ${String(id)}`);
      }

      return existingContainer;
    }

    const container = new Container(id, parentContainer);

    ContainerRegistry.registerContainer(container);

    return container;
  }

  public ofChild(id: ContainerIdentifier) {
    return Container.ofChild(id, this);
  }

  public register<T>(metadata: Metadata<T>) {
    this.ensureNotDisposed();

    if (metadata.scope === 'singleton' && !this.isRoot()) {
      this.getRoot().register(metadata);
      this.metadataMap.delete(metadata.id);
      return this;
    }

    const newMetadata = this.cloneMetadata(metadata);

    if (newMetadata.multiple) {
      this.pushMultiMetadata(newMetadata.id, newMetadata);
      return this;
    }

    const existingMetadata = this.metadataMap.get(newMetadata.id);

    if (existingMetadata) {
      Object.assign(existingMetadata, newMetadata);
    } else {
      this.metadataMap.set(newMetadata.id, newMetadata);
    }

    return this;
  }

  public has(id: ServiceIdentifier): boolean {
    this.ensureNotDisposed();

    return (
      this.bindingMap.has(id) ||
      this.metadataMap.has(id) ||
      (this.multiBindingMap.get(id)?.length ?? 0) > 0 ||
      (this.multiMetadataMap.get(id)?.length ?? 0) > 0 ||
      (this.inheritedMultiMetadataMap.get(id)?.size ?? 0) > 0
    );
  }

  public set<T>(id: ServiceIdentifier<T>, value: T): this;
  public set<T>(id: ServiceIdentifier<T>, provider: ServiceProvider<T>): this;
  public set<T>(id: ServiceIdentifier<T>, valueOrProvider: T | ServiceProvider<T>) {
    this.ensureNotDisposed();

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

  public add<T>(id: ServiceIdentifier<T>, value: T): this;
  public add<T>(id: ServiceIdentifier<T>, provider: ServiceProvider<T>): this;
  public add<T>(id: ServiceIdentifier<T>, valueOrProvider: T | ServiceProvider<T>) {
    this.ensureNotDisposed();

    if (this.isValueProvider(valueOrProvider)) {
      this.pushMultiBinding(id, valueOrProvider.useValue);
      return this;
    }

    if (this.isClassProvider(valueOrProvider)) {
      return this.register(this.getClassProviderMetadata(id, valueOrProvider, true));
    }

    if (this.isFactoryProvider(valueOrProvider)) {
      return this.register(this.getFactoryProviderMetadata(id, valueOrProvider, true));
    }

    this.pushMultiBinding(id, valueOrProvider);
    return this;
  }

  public remove(id: ServiceIdentifier) {
    this.ensureNotDisposed();
    this.bindingMap.delete(id);
    this.metadataMap.delete(id);
    this.multiBindingMap.delete(id);
    this.multiMetadataMap.delete(id);
    this.inheritedMultiMetadataMap.delete(id);
    return this;
  }

  public reset(strategy: 'value' | 'service' = 'value') {
    this.ensureNotDisposed();

    if (strategy === 'value') {
      this.resetMetadataValues();
      return this;
    }

    this.bindingMap.clear();
    this.metadataMap.clear();
    this.multiBindingMap.clear();
    this.multiMetadataMap.clear();
    this.inheritedMultiMetadataMap.clear();

    return this;
  }

  public get<T>(id: ServiceIdentifier<T>): T {
    this.ensureNotDisposed();

    if (this.bindingMap.has(id)) {
      return this.bindingMap.get(id) as T;
    }

    const localMetadata = this.metadataMap.get(id) as Metadata<T> | undefined;

    if (localMetadata) {
      return this.resolveMetadata(localMetadata, this);
    }

    const bindingOwner = this.parentContainer?.findBindingOwner(id);

    if (bindingOwner) {
      return bindingOwner.bindingMap.get(id) as T;
    }

    const metadataOwner = this.parentContainer?.findMetadataOwner(id);

    if (!metadataOwner) {
      throw new ServiceNotFoundError(id);
    }

    const metadata = metadataOwner.metadataMap.get(id) as Metadata<T>;

    if (metadata.scope === 'singleton') {
      return metadataOwner.resolveMetadata(metadata, metadataOwner);
    }

    if (metadata.scope === 'container') {
      const localizedMetadata = this.cloneMetadata(metadata);

      this.metadataMap.set(id, localizedMetadata);

      return this.resolveMetadata(localizedMetadata, this);
    }

    return this.resolveMetadata(metadata, this);
  }

  public getMany<T>(id: ServiceIdentifier<T>): T[] {
    this.ensureNotDisposed();

    const resolved: T[] = [];

    for (const container of this.getLineage()) {
      const bindings = container.multiBindingMap.get(id) ?? [];

      resolved.push(...(bindings as T[]));

      const registrations = container.multiMetadataMap.get(id) as Metadata<T>[] | undefined;

      if (!registrations) {
        continue;
      }

      for (const metadata of registrations) {
        if (container === this) {
          resolved.push(this.resolveMetadata(metadata, this));
          continue;
        }

        if (metadata.scope === 'singleton') {
          resolved.push(container.resolveMetadata(metadata, container));
          continue;
        }

        if (metadata.scope === 'container') {
          const localizedMetadata = this.getOrCreateInheritedMultiMetadata(id, metadata);

          resolved.push(this.resolveMetadata(localizedMetadata, this));
          continue;
        }

        resolved.push(this.resolveMetadata(metadata, this));
      }
    }

    return resolved;
  }

  public tryGet<T>(id: ServiceIdentifier<T>): T | undefined {
    this.ensureNotDisposed();

    if (!this.canResolve(id)) {
      return undefined;
    }

    return this.get(id);
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const childContainers = [...this.children];

    for (const child of childContainers) {
      await child.dispose();
    }

    const ownedValues = this.collectOwnedValues();

    this.disposed = true;
    ContainerRegistry.disposeContainer(this);
    this.bindingMap.clear();
    this.metadataMap.clear();
    this.multiBindingMap.clear();
    this.multiMetadataMap.clear();
    this.inheritedMultiMetadataMap.clear();
    this.children.clear();
    this.resolving.clear();
    this.resolvingPath = [];

    for (const value of ownedValues) {
      if (this.isDisposable(value)) {
        await value.dispose();
      }
    }
  }

  public static reset(containerId: ContainerIdentifier, options?: { strategy?: 'value' | 'service' }) {
    const container = ContainerRegistry.getContainer(containerId);

    container?.reset(options?.strategy);
  }
}
