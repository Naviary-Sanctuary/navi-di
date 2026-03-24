import { INJECTION_KEY, type InjectionMetadata, type ServiceIdentifier } from '../types';

/**
 * Injects a dependency into a class field when the service is resolved.
 *
 * Use this field decorator on service properties that should be resolved from
 * the container that creates the service instance.
 *
 * The dependency is assigned after the instance is created, so it is not
 * available in constructors or field initializers.
 *
 * @param dependency The service identifier to inject into the decorated field.
 */
export function Inject<T>(dependency: ServiceIdentifier<T>) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    const injections = (context.metadata[INJECTION_KEY] ??= []) as InjectionMetadata[];

    injections.push({
      id: dependency,
      name: context.name,
    });
  };
}
