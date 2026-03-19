import type { Constructable } from './constructable';
import type { InjectionMetadata } from './injection';
import type { ServiceIdentifier } from './service';

export type ContainerIdentifier = string | symbol;

export interface Metadata<T = unknown> {
  id: ServiceIdentifier;
  Class: Constructable<T>;
  name?: string | symbol;
  injections: InjectionMetadata[];
}
