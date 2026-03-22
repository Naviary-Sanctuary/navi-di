import { afterEach, describe, expect, test } from 'bun:test';
import { Container } from '../../src';
import { CircularDependencyError, ServiceNotFoundError } from '../../src/errors';
import { ContainerRegistry } from '../../src/container/registry';
import { EMPTY_VALUE } from '../../src/types';

afterEach(() => {
  Container.of().reset('service');
  ContainerRegistry.removeContainer('container-reused');
  ContainerRegistry.removeContainer('container-first');
  ContainerRegistry.removeContainer('container-second');
  ContainerRegistry.removeContainer('container-scope');
  ContainerRegistry.removeContainer('singleton-forwarded');
  ContainerRegistry.removeContainer('container-reset-fallback');
  ContainerRegistry.removeContainer('container-local-has');
  ContainerRegistry.removeContainer('container-post-error');
});

describe('Container', () => {
  test('returns the default container for no id and the default id', () => {
    expect(Container.of()).toBe(Container.of('default'));
  });

  test('reuses named containers for the same id', () => {
    expect(Container.of('container-reused')).toBe(Container.of('container-reused'));
  });

  test('creates distinct named containers for different ids', () => {
    expect(Container.of('container-first')).not.toBe(Container.of('container-second'));
  });

  test('reuses container-scoped services within the same container and isolates them across containers', () => {
    const requestContainer = Container.of('container-scope');

    class RequestService {}

    Container.of().set({
      id: RequestService,
      Class: RequestService,
      name: 'RequestService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    const defaultFirst = Container.of().get(RequestService);
    const defaultSecond = Container.of().get(RequestService);
    const requestFirst = requestContainer.get(RequestService);
    const requestSecond = requestContainer.get(RequestService);

    expect(defaultFirst).toBe(defaultSecond);
    expect(requestFirst).toBe(requestSecond);
    expect(defaultFirst).not.toBe(requestFirst);
  });

  test('stores singleton registrations in the default container when set from a named container', () => {
    const requestContainer = Container.of('singleton-forwarded');

    class SingletonService {}

    requestContainer.set({
      id: SingletonService,
      Class: SingletonService,
      name: 'SingletonService',
      injections: [],
      scope: 'singleton',
      value: EMPTY_VALUE,
    });

    expect(requestContainer.has(SingletonService)).toBe(false);
    expect(Container.of().has(SingletonService)).toBe(true);
    expect(requestContainer.get(SingletonService)).toBe(Container.of().get(SingletonService));
  });

  test('reset value clears cached instances but keeps registrations', () => {
    class ResettableService {}

    Container.of().set({
      id: ResettableService,
      Class: ResettableService,
      name: 'ResettableService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    const beforeReset = Container.of().get(ResettableService);

    Container.of().reset('value');

    const afterReset = Container.of().get(ResettableService);

    expect(afterReset).toBeInstanceOf(ResettableService);
    expect(afterReset).not.toBe(beforeReset);
  });

  test('reset service removes registrations from the current container', () => {
    class ResettableService {}

    Container.of().set({
      id: ResettableService,
      Class: ResettableService,
      name: 'ResettableService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    Container.of().reset('service');

    expect(() => Container.of().get(ResettableService)).toThrow(ServiceNotFoundError);
  });

  test('reset service on a named container clears local copies and falls back to default registrations again', () => {
    const requestContainer = Container.of('container-reset-fallback');

    class ResettableService {}

    Container.of().set({
      id: ResettableService,
      Class: ResettableService,
      name: 'ResettableService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    const first = requestContainer.get(ResettableService);

    requestContainer.reset('service');

    const second = requestContainer.get(ResettableService);

    expect(second).toBeInstanceOf(ResettableService);
    expect(second).not.toBe(first);
    expect(second).not.toBe(Container.of().get(ResettableService));
  });

  test('reset specific container with static method', () => {
    class ResettableService {}

    Container.of('container').set({
      id: ResettableService,
      Class: ResettableService,
      name: 'ResettableService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    Container.reset('container', { strategy: 'service' });

    expect(() => ContainerRegistry.getContainer('container')?.get(ResettableService)).toThrow(ServiceNotFoundError);
  });

  test('has only reports local registrations', () => {
    const requestContainer = Container.of('container-local-has');

    class ScopedService {}

    Container.of().set({
      id: ScopedService,
      Class: ScopedService,
      name: 'ScopedService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    expect(Container.of().has(ScopedService)).toBe(true);
    expect(requestContainer.has(ScopedService)).toBe(false);

    requestContainer.get(ScopedService);

    expect(requestContainer.has(ScopedService)).toBe(true);
  });

  test('throws when a service is missing', () => {
    class MissingService {}

    expect(() => Container.of().get(MissingService)).toThrow(ServiceNotFoundError);
  });

  test('throws when dependencies form a circular graph', () => {
    class AlphaService {
      public beta!: BetaService;
    }

    class BetaService {
      public alpha!: AlphaService;
    }

    Container.of().set({
      id: AlphaService,
      Class: AlphaService,
      name: 'AlphaService',
      injections: [{ id: BetaService, name: 'beta' }],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    Container.of().set({
      id: BetaService,
      Class: BetaService,
      name: 'BetaService',
      injections: [{ id: AlphaService, name: 'alpha' }],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    expect(() => Container.of().get(AlphaService)).toThrow(CircularDependencyError);
  });

  test('recovers cleanly after a circular resolution error', () => {
    const requestContainer = Container.of('container-post-error');

    class AlphaService {
      public beta!: BetaService;
    }

    class BetaService {
      public alpha!: AlphaService;
    }

    class HealthyService {}

    requestContainer.set({
      id: AlphaService,
      Class: AlphaService,
      name: 'AlphaService',
      injections: [{ id: BetaService, name: 'beta' }],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    requestContainer.set({
      id: BetaService,
      Class: BetaService,
      name: 'BetaService',
      injections: [{ id: AlphaService, name: 'alpha' }],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    requestContainer.set({
      id: HealthyService,
      Class: HealthyService,
      name: 'HealthyService',
      injections: [],
      scope: 'container',
      value: EMPTY_VALUE,
    });

    expect(() => requestContainer.get(AlphaService)).toThrow(CircularDependencyError);
    expect(requestContainer.get(HealthyService)).toBeInstanceOf(HealthyService);
  });
});
