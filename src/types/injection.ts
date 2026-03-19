import type { ServiceIdentifier } from './service';

export interface InjectionMetadata {
  id: ServiceIdentifier;
  name: string | symbol;
}

export const INJECTION_KEY = Symbol.for('es-di:injections');
