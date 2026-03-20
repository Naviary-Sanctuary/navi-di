import { ContainerRegistry } from '../container/registry';
import type { Constructable, InjectionMetadata, ServiceOption } from '../types';
import { INJECTION_KEY, EMPTY_VALUE } from '../types';

export function Service(): Function;
export function Service(options?: ServiceOption): Function;
export function Service<T>(options?: ServiceOption) {
  return function (target: Constructable<T>, context: DecoratorContext) {
    const injections = (context.metadata[INJECTION_KEY] ?? []) as InjectionMetadata[];

    ContainerRegistry.defaultContainer.set({
      id: options?.id ?? target,
      Class: target,
      name: context.name,
      injections,
      scope: options?.scope ?? 'container',
      value: EMPTY_VALUE,
    });
  };
}
