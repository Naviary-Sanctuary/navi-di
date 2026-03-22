import type { Token } from '../tokens';
import type { AbstractConstructable, Constructable } from './constructable';

export type ServiceIdentifier<T = unknown, Args extends unknown[] = never[]> =
  | Constructable<T, Args>
  | AbstractConstructable<T, Args>
  | CallableFunction
  | string
  | Token<T>;

export type ServiceScope = 'singleton' | 'container' | 'transient';

export interface ServiceOption {
  id?: ServiceIdentifier;
  scope?: ServiceScope;
}
