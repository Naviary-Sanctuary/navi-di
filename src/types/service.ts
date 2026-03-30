import type { Token } from '../tokens';
import type { AbstractConstructable, Constructable } from './constructable';

/**
 * An identifier that can be used to register or resolve a service.
 */
export type ServiceIdentifier<T = unknown, Args extends unknown[] = never[]> =
  | Constructable<T, Args>
  | AbstractConstructable<T, Args>
  | CallableFunction
  | string
  | Token<T>;

/**
 * The lifetime used when a service is resolved from a container.
 */
export type ServiceScope = 'singleton' | 'container' | 'transient';

/**
 * Options for registering a service with `@Service()`.
 */
export interface ServiceOption {
  /**
   * A custom identifier used to resolve the service.
   */
  id?: ServiceIdentifier;

  /**
   * The lifetime used when the service is resolved.
   */
  scope?: ServiceScope;

  multiple?: boolean;
}
