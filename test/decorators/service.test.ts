import { afterEach, describe, expect, test } from 'bun:test';
import { Container, Service } from '../../src';
import { ServiceNotFoundError } from '../../src/errors';
import { ContainerRegistry } from '../../src/container/registry';

afterEach(() => {
  Container.of().reset('service');
  ContainerRegistry.removeContainer('service-singleton-container');
});

describe('Service Decorator', () => {
  test('registers a decorated class in the default container', () => {
    @Service()
    class TestService {}

    expect(Container.of().get(TestService)).toBeInstanceOf(TestService);
  });

  test('supports custom service identifiers', () => {
    @Service({ id: 'custom-service' })
    class NamedService {}

    expect(Container.of().get('custom-service')).toBeInstanceOf(NamedService);
    expect(() => Container.of().get(NamedService)).toThrow(ServiceNotFoundError);
  });

  test('honors transient scope declared through the decorator', () => {
    @Service({ scope: 'transient' })
    class TransientService {}

    const first = Container.of().get(TransientService);
    const second = Container.of().get(TransientService);

    expect(first).not.toBe(second);
  });

  test('honors singleton scope declared through the decorator across containers', () => {
    const requestContainer = Container.of('service-singleton-container');

    @Service({ scope: 'singleton' })
    class SingletonService {}

    expect(Container.of().get(SingletonService)).toBe(requestContainer.get(SingletonService));
  });
});
