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

/**
 * Registers a class as a service that can be resolved from a container.
 *
 * By default, the decorated class is registered in the default container,
 * uses its own class as the service identifier, and uses the `container`
 * scope.
 *
 * Use this decorator with a custom identifier or `scope` option when you need
 * to change how the service is registered or reused. When you provide a
 * custom identifier, resolve the service by that identifier.
 */
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
