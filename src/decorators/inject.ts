import { INJECTION_KEY, type InjectionMetadata, type ServiceIdentifier } from '../types';

export function Inject<T>(dependency: ServiceIdentifier<T>) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    const injections = (context.metadata[INJECTION_KEY] ??= []) as InjectionMetadata[];

    injections.push({
      id: dependency,
      name: context.name,
    });
  };
}
