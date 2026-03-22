import { ContainerRegistry } from '../container/registry';
import type { Constructable, InjectionMetadata, ServiceIdentifier, ServiceOption } from '../types';
import { INJECTION_KEY, EMPTY_VALUE } from '../types';

function normalizeArguments(args?: ServiceIdentifier | ServiceOption): ServiceOption {
  if (!args) {
    return {};
  }

  if (typeof args === 'object' && ('scope' in args || 'id' in args)) {
    return args;
  }

  return { id: args };
}

export function Service(): Function;
export function Service(id: ServiceIdentifier): Function;
export function Service(options?: ServiceOption): Function;
export function Service<T>(idOrOptions?: ServiceIdentifier | ServiceOption) {
  return function (target: Constructable<T>, context: DecoratorContext) {
    const options = normalizeArguments(idOrOptions);

    const injections = (context.metadata[INJECTION_KEY] ?? []) as InjectionMetadata[];

    ContainerRegistry.defaultContainer.register({
      id: options?.id ?? target,
      Class: target,
      name: context.name,
      injections,
      scope: options?.scope ?? 'container',
      value: EMPTY_VALUE,
    });
  };
}
