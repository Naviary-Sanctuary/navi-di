import type { AbstractConstructable, Constructable } from './constructable';

export type ServiceIdentifier<T = unknown, Args extends unknown[] = never[]> =
  | Constructable<T, Args>
  | AbstractConstructable<T, Args>
  | CallableFunction
  | string;

export interface ServiceOption {
  id: ServiceIdentifier;
}
