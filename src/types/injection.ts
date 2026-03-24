import type { ServiceIdentifier } from './service';

/**
 * Property injection metadata collected for a service.
 */
export interface InjectionMetadata {
  /**
   * The identifier of the dependency to inject.
   */
  id: ServiceIdentifier;

  /**
   * The class field that receives the resolved dependency.
   */
  name: string | symbol;
}

/**
 * Metadata key used internally to store property injection definitions.
 */
export const INJECTION_KEY = Symbol.for('navi-di:injections');
