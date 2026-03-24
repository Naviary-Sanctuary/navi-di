import type { Constructable } from './constructable';
import type { InjectionMetadata } from './injection';
import type { ServiceIdentifier, ServiceScope } from './service';

/**
 * A container identifier used to select the default container or a named container.
 */
export type ContainerIdentifier = string | symbol;

/**
 * Sentinel value used internally to mark services that have not been instantiated yet.
 */
export const EMPTY_VALUE = Symbol.for('EMPTY_VALUE');

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
  Class: Constructable<T>;

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
}
