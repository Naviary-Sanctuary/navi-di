import type { Constructable } from './constructable';
import type { InjectionMetadata } from './injection';
import type { ServiceIdentifier, ServiceScope } from './service';
import type { Container } from '../container';

/**
 * A container identifier used to select the default container or a named container.
 */
export type ContainerIdentifier = string | symbol;

/**
 * Sentinel value used internally to mark services that have not been instantiated yet.
 */
export const EMPTY_VALUE = Symbol.for('EMPTY_VALUE');

/**
 * A factory function that creates a service using the current container.
 */
export type ServiceFactory<T> = (container: Container) => T;

/**
 * A provider that always resolves to the same explicit value.
 */
export interface ValueProvider<T> {
  /**
   * The value returned for the registered identifier.
   */
  useValue: T;
}

/**
 * A provider that resolves by instantiating a class.
 */
export interface ClassProvider<T> {
  /**
   * The class instantiated when the service is resolved.
   */
  useClass: Constructable<T>;

  /**
   * Optional property injection definitions for the registered class.
   */
  injections?: InjectionMetadata[];

  /**
   * The lifetime used when the service is resolved.
   */
  scope?: ServiceScope;
}

/**
 * A provider that resolves by calling a factory function.
 */
export interface FactoryProvider<T> {
  /**
   * The factory used to create the resolved value.
   */
  useFactory: ServiceFactory<T>;

  /**
   * The lifetime used when the service is resolved.
   */
  scope?: ServiceScope;
}

/**
 * A provider object accepted by low-level container registration APIs.
 */
export type ServiceProvider<T> = ValueProvider<T> | ClassProvider<T> | FactoryProvider<T>;

/**
 * Service registration metadata stored by a container.
 *
 * This is primarily used by low-level registration APIs and internal container logic.
 */
export interface Metadata<T = unknown> {
  /**
   * The identifier used to resolve the service.
   */
  id: ServiceIdentifier;

  /**
   * The class instantiated for this service.
   */
  Class?: Constructable<T>;

  /**
   * The original class or member name, when available.
   */
  name?: string | symbol;

  /**
   * Property injection definitions collected for the service.
   */
  injections: InjectionMetadata[];

  /**
   * The lifetime used when resolving the service.
   */
  scope: ServiceScope;

  /**
   * The cached service instance, or `EMPTY_VALUE` when no instance is cached.
   */
  value: T | typeof EMPTY_VALUE;

  /**
   * An optional factory used to create the resolved value.
   */
  factory?: ServiceFactory<T>;
}
