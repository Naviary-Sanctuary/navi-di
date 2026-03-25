import { afterEach, describe, expect, test } from 'bun:test';
import { Container } from '../../src';
import { CircularDependencyError, ServiceNotFoundError } from '../../src/errors';
import { ContainerRegistry } from '../../src/container/registry';
import { EMPTY_VALUE } from '../../src/types';

afterEach(() => {
  Container.of().reset('service');
  ContainerRegistry.removeContainer('container');
  ContainerRegistry.removeContainer('container-reused');
  ContainerRegistry.removeContainer('container-first');
  ContainerRegistry.removeContainer('container-second');
  ContainerRegistry.removeContainer('container-scope');
  ContainerRegistry.removeContainer('container-binding');
  ContainerRegistry.removeContainer('container-binding-reset');
  ContainerRegistry.removeContainer('singleton-forwarded');
  ContainerRegistry.removeContainer('container-reset-fallback');
  ContainerRegistry.removeContainer('container-local-has');
  ContainerRegistry.removeContainer('container-post-error');
  ContainerRegistry.removeContainer('factory-container-scope');
  ContainerRegistry.removeContainer('factory-singleton-scope');
});

describe('Container', () => {
  describe('of', () => {
    test('returns the default container for no id and the default id', () => {
      expect(Container.of()).toBe(Container.of('default'));
    });

    test('reuses named containers for the same id', () => {
      expect(Container.of('container-reused')).toBe(Container.of('container-reused'));
    });

    test('creates distinct named containers for different ids', () => {
      expect(Container.of('container-first')).not.toBe(Container.of('container-second'));
    });
  });

  describe('register', () => {
    test('reuses container-scoped services within the same container and isolates them across containers', () => {
      const requestContainer = Container.of('container-scope');

      class RequestService {}

      Container.of().register({
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

      requestContainer.register({
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
  });

  describe('set', () => {
    test('returns a bound value set on the current container', () => {
      class BoundService {}

      const bound = new BoundService();

      Container.of().set(BoundService, bound);

      expect(Container.of().get(BoundService)).toBe(bound);
    });

    test('prefers a bound value over a registered service in the same container', () => {
      class BoundService {}

      const bound = new BoundService();

      Container.of().register({
        id: BoundService,
        Class: BoundService,
        name: 'BoundService',
        injections: [],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      Container.of().set(BoundService, bound);

      expect(Container.of().get(BoundService)).toBe(bound);
    });

    test('registers a class provider for a custom identifier', () => {
      interface Logger {
        log(message: string): string;
      }

      class ConsoleLogger implements Logger {
        public log(message: string) {
          return message;
        }
      }

      Container.of().set<Logger>('logger', { useClass: ConsoleLogger });

      const logger = Container.of().get<Logger>('logger');

      expect(logger).toBeInstanceOf(ConsoleLogger);
      expect(logger.log('hello')).toBe('hello');
    });

    test('registers a factory provider that can resolve from the current container', () => {
      class DependencyService {
        public readonly name = 'dependency';
      }

      class CompositeService {
        constructor(public readonly dependency: DependencyService) {}
      }

      Container.of().register({
        id: DependencyService,
        Class: DependencyService,
        name: 'DependencyService',
        injections: [],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      Container.of().set(CompositeService, {
        useFactory: (container) => new CompositeService(container.get(DependencyService)),
      });

      const composite = Container.of().get(CompositeService);

      expect(composite).toBeInstanceOf(CompositeService);
      expect(composite.dependency).toBe(Container.of().get(DependencyService));
    });

    test('supports container-scoped factory providers per named container', () => {
      const firstContainer = Container.of('factory-container-scope');
      let created = 0;

      Container.of().set('request-id', {
        useFactory: () => ({ id: ++created }),
        scope: 'container',
      });

      const defaultFirst = Container.of().get<{ id: number }>('request-id');
      const defaultSecond = Container.of().get<{ id: number }>('request-id');
      const namedFirst = firstContainer.get<{ id: number }>('request-id');
      const namedSecond = firstContainer.get<{ id: number }>('request-id');

      expect(defaultFirst).toBe(defaultSecond);
      expect(namedFirst).toBe(namedSecond);
      expect(defaultFirst).not.toBe(namedFirst);
    });

    test('supports singleton factory providers across containers', () => {
      const requestContainer = Container.of('factory-singleton-scope');
      let created = 0;

      Container.of().set('singleton-id', {
        useFactory: () => ({ id: ++created }),
        scope: 'singleton',
      });

      const defaultInstance = Container.of().get<{ id: number }>('singleton-id');
      const requestInstance = requestContainer.get<{ id: number }>('singleton-id');

      expect(defaultInstance).toBe(requestInstance);
      expect(created).toBe(1);
    });
  });

  describe('remove', () => {
    test('clears a bound value from the current container', () => {
      const requestContainer = Container.of('container-binding');

      class BoundService {}

      const bound = new BoundService();

      requestContainer.set(BoundService, bound);

      expect(requestContainer.get(BoundService)).toBe(bound);

      requestContainer.remove(BoundService);

      expect(() => requestContainer.get(BoundService)).toThrow(ServiceNotFoundError);
    });
  });

  describe('reset', () => {
    describe("'value'", () => {
      test('clears cached instances but keeps registrations', () => {
        class ResettableService {}

        Container.of().register({
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

      test('keeps bound values intact', () => {
        class BoundService {}

        const bound = new BoundService();

        Container.of().set(BoundService, bound);
        Container.of().reset('value');

        expect(Container.of().get(BoundService)).toBe(bound);
      });
    });

    describe("'service'", () => {
      test('removes registrations from the current container', () => {
        class ResettableService {}

        Container.of().register({
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

      test('removes bound values from the current container', () => {
        const requestContainer = Container.of('container-binding-reset');

        class BoundService {}

        const bound = new BoundService();

        requestContainer.set(BoundService, bound);
        requestContainer.reset('service');

        expect(() => requestContainer.get(BoundService)).toThrow(ServiceNotFoundError);
      });

      test('on a named container clears local copies and falls back to default registrations again', () => {
        const requestContainer = Container.of('container-reset-fallback');

        class ResettableService {}

        Container.of().register({
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
    });

    describe('static reset', () => {
      test('resets a specific container', () => {
        class ResettableService {}

        Container.of('container').register({
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
    });
  });

  describe('has', () => {
    test('only reports local registrations', () => {
      const requestContainer = Container.of('container-local-has');

      class ScopedService {}

      Container.of().register({
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
  });

  describe('get', () => {
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

      Container.of().register({
        id: AlphaService,
        Class: AlphaService,
        name: 'AlphaService',
        injections: [{ id: BetaService, name: 'beta' }],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      Container.of().register({
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

      requestContainer.register({
        id: AlphaService,
        Class: AlphaService,
        name: 'AlphaService',
        injections: [{ id: BetaService, name: 'beta' }],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      requestContainer.register({
        id: BetaService,
        Class: BetaService,
        name: 'BetaService',
        injections: [{ id: AlphaService, name: 'alpha' }],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      requestContainer.register({
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
});
