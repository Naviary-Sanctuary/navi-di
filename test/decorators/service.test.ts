import { afterEach, describe, expect, test } from 'bun:test';
import { Container, Inject, Service } from '../../src';
import { CircularDependencyError, ServiceNotFoundError } from '../../src/errors';
import { EMPTY_VALUE } from '../../src/types';

afterEach(() => {
  Container.of().reset('service');
});

describe('Service Decorator', () => {
  test('registers a decorated class in the default container', () => {
    @Service()
    class TestService {}

    expect(Container.of().get(TestService)).toBeInstanceOf(TestService);
  });

  test('injects decorated class fields', () => {
    @Service()
    class LoggerService {}

    @Service()
    class HandlerService {
      @Inject(LoggerService)
      public logger!: LoggerService;
    }

    const handler = Container.of().get(HandlerService);

    expect(handler.logger).toBeInstanceOf(LoggerService);
    expect(handler.logger).toBe(Container.of().get(LoggerService));
  });

  test('reuses container-scoped services within the same container and isolates them across containers', () => {
    const requestContainer = Container.of(Symbol('request-container'));

    @Service()
    class RequestService {}

    const defaultFirst = Container.of().get(RequestService);
    const defaultSecond = Container.of().get(RequestService);
    const requestFirst = requestContainer.get(RequestService);
    const requestSecond = requestContainer.get(RequestService);

    expect(defaultFirst).toBe(defaultSecond);
    expect(requestFirst).toBe(requestSecond);
    expect(defaultFirst).not.toBe(requestFirst);
  });

  test('shares singleton services between the default and named containers', () => {
    const requestContainer = Container.of(Symbol('singleton-container'));

    class SingletonService {}

    requestContainer.set({
      id: SingletonService,
      Class: SingletonService,
      name: 'SingletonService',
      injections: [],
      scope: 'singleton',
      value: EMPTY_VALUE,
    });

    const fromDefault = Container.of().get(SingletonService);
    const fromRequest = requestContainer.get(SingletonService);

    expect(fromRequest).toBe(fromDefault);
  });

  test('creates a fresh transient service every time', () => {
    class TransientService {}

    Container.of().set({
      id: TransientService,
      Class: TransientService,
      name: 'TransientService',
      injections: [],
      scope: 'transient',
      value: EMPTY_VALUE,
    });

    const first = Container.of().get(TransientService);
    const second = Container.of().get(TransientService);

    expect(first).not.toBe(second);
  });

  test('reset value clears cached instances but keeps registrations', () => {
    @Service()
    class ResettableService {}

    const beforeReset = Container.of().get(ResettableService);

    Container.of().reset('value');

    const afterReset = Container.of().get(ResettableService);

    expect(afterReset).toBeInstanceOf(ResettableService);
    expect(afterReset).not.toBe(beforeReset);
  });

  test('reset service removes registrations', () => {
    @Service()
    class ResettableService {}

    Container.of().get(ResettableService);
    Container.of().reset('service');

    expect(() => Container.of().get(ResettableService)).toThrow(ServiceNotFoundError);
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
});
