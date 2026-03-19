import { INJECTION_KEY, type Constructable, type InjectionMetadata } from '../types';

export function Inject<T>(dependency: Constructable<T>) {
  return function (_: undefined, context: ClassFieldDecoratorContext) {
    const injections = (context.metadata[INJECTION_KEY] ??= []) as InjectionMetadata[];

    injections.push({
      id: dependency,
      name: context.name,
    });
  };
}
