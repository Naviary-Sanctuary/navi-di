import type { Constructable } from './constructable';
import type { InjectionMetadata } from './injection';
import type { ServiceIdentifier, ServiceScope } from './service';

export type ContainerIdentifier = string | symbol;

export const EMPTY_VALUE = Symbol.for('EMPTY_VALUE');

export interface Metadata<T = unknown> {
  id: ServiceIdentifier;
  Class: Constructable<T>;
  name?: string | symbol;
  injections: InjectionMetadata[];
  scope: ServiceScope;
  value: T | typeof EMPTY_VALUE;
}
