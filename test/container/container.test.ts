import { afterEach, describe, expect, test } from 'bun:test';
import { Container } from '../../src';
import { CircularDependencyError, ContainerDisposedError, ServiceNotFoundError } from '../../src/errors';
import { ContainerRegistry } from '../../src/container/registry';
import { EMPTY_VALUE } from '../../src/types';

const CONTAINER_IDS = [
  'container',
  'container-reused',
  'container-first',
  'container-second',
  'container-scope',
  'container-binding',
  'container-binding-reset',
  'singleton-forwarded',
  'container-reset-fallback',
  'container-local-has',
  'container-post-error',
  'factory-container-scope',
  'factory-singleton-scope',
  'container-try-get',
  'container-dispose',
  'container-dispose-recreate',
  'container-binding-fallback',
  'hierarchy-parent',
  'hierarchy-child',
  'hierarchy-grandchild',
  'hierarchy-sibling',
  'hierarchy-dispose-parent',
  'hierarchy-dispose-child',
  'multi-child',
  'multi-parent',
] as const;

afterEach(() => {
  Container.of().reset('service');

  for (const id of CONTAINER_IDS) {
    if (ContainerRegistry.hasContainer(id)) {
      ContainerRegistry.removeContainer(id);
    }
  }
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

  describe('ofChild', () => {
    test('creates hierarchical child containers under a custom parent', () => {
      const parent = Container.of('hierarchy-parent');
      const child = parent.ofChild('hierarchy-child');
      const grandchild = child.ofChild('hierarchy-grandchild');

      parent.set('config', { name: 'parent' });

      expect(child.parent).toBe(parent);
      expect(grandchild.parent).toBe(child);
      expect(child.get<{ name: string }>('config')).toEqual({ name: 'parent' });
      expect(grandchild.get<{ name: string }>('config')).toEqual({ name: 'parent' });
    });

    test('prefers the nearest ancestor registration in the hierarchy', () => {
      const parent = Container.of('hierarchy-parent');
      const child = parent.ofChild('hierarchy-child');

      Container.of().set('level', 'root');
      parent.set('level', 'parent');

      expect(child.get<string>('level')).toBe('parent');
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

    test('falls back to a value bound on the default container', () => {
      const requestContainer = Container.of('container-binding-fallback');

      class BoundService {}

      const bound = new BoundService();

      Container.of().set(BoundService, bound);

      expect(requestContainer.get(BoundService)).toBe(bound);
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

    test('reports local bindings through has()', () => {
      class BoundService {}

      const bound = new BoundService();

      Container.of().set(BoundService, bound);

      expect(Container.of().has(BoundService)).toBe(true);
    });
  });

  describe('add and getMany', () => {
    test('returns all locally added multi-bindings in insertion order', () => {
      Container.of().add('logger', { useValue: 'console' });
      Container.of().add('logger', { useValue: 'file' });

      expect(Container.of().getMany('logger')).toEqual(['console', 'file']);
    });

    test('aggregates multi-bindings from ancestors before local bindings', () => {
      const parent = Container.of('multi-parent');
      const child = parent.ofChild('multi-child');

      parent.add('logger', { useValue: 'parent' });
      child.add('logger', { useValue: 'child' });

      expect(child.getMany('logger')).toEqual(['parent', 'child']);
    });

    test('creates container-scoped multi-bindings per container', () => {
      const child = Container.of('multi-parent').ofChild('multi-child');
      let created = 0;

      Container.of().add('request', {
        useFactory: () => ({ id: ++created }),
        scope: 'container',
      });

      const defaultFirst = Container.of().getMany<{ id: number }>('request')[0];
      const defaultSecond = Container.of().getMany<{ id: number }>('request')[0];
      const childFirst = child.getMany<{ id: number }>('request')[0];
      const childSecond = child.getMany<{ id: number }>('request')[0];

      expect(defaultFirst).toBe(defaultSecond);
      expect(childFirst).toBe(childSecond);
      expect(defaultFirst).not.toBe(childFirst);
    });

    test('shares singleton multi-bindings across the hierarchy', () => {
      const child = Container.of('multi-parent').ofChild('multi-child');
      let created = 0;

      child.add('singleton-logger', {
        useFactory: () => ({ id: ++created }),
        scope: 'singleton',
      });

      const rootValue = Container.of().getMany<{ id: number }>('singleton-logger')[0];
      const childValue = child.getMany<{ id: number }>('singleton-logger')[0];

      expect(rootValue).toBe(childValue);
      expect(created).toBe(1);
    });

    test('returns an empty array when no multi-binding exists', () => {
      expect(Container.of().getMany('missing')).toEqual([]);
    });

    test('remove clears local multi-bindings', () => {
      Container.of().add('logger', { useValue: 'console' });
      Container.of().add('logger', { useValue: 'file' });

      Container.of().remove('logger');

      expect(Container.of().getMany('logger')).toEqual([]);
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

  describe('tryGet', () => {
    test('returns undefined when a service is missing', () => {
      class MissingService {}

      expect(Container.of().tryGet(MissingService)).toBeUndefined();
    });

    test('returns undefined when a named container has no local or fallback registration', () => {
      expect(Container.of('container-try-get').tryGet('missing')).toBeUndefined();
    });

    test('returns a resolved service when one exists', () => {
      const requestContainer = Container.of('container-try-get');

      class ExistingService {}

      requestContainer.register({
        id: ExistingService,
        Class: ExistingService,
        name: 'ExistingService',
        injections: [],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      expect(requestContainer.tryGet(ExistingService)).toBeInstanceOf(ExistingService);
    });

    test('resolves default-container bindings through named-container fallback', () => {
      const requestContainer = Container.of('container-try-get');

      class ExistingService {}

      const bound = new ExistingService();

      Container.of().set(ExistingService, bound);

      expect(requestContainer.tryGet(ExistingService)).toBe(bound);
    });

    test('does not swallow missing nested dependencies', () => {
      class MissingDependency {}

      class ExistingService {
        public dependency!: MissingDependency;
      }

      Container.of('container-try-get').register({
        id: ExistingService,
        Class: ExistingService,
        name: 'ExistingService',
        injections: [{ id: MissingDependency, name: 'dependency' }],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      expect(() => Container.of('container-try-get').tryGet(ExistingService)).toThrow(ServiceNotFoundError);
    });

    test('does not swallow circular dependency errors', () => {
      class AlphaService {
        public beta!: BetaService;
      }

      class BetaService {
        public alpha!: AlphaService;
      }

      Container.of('container-try-get').register({
        id: AlphaService,
        Class: AlphaService,
        name: 'AlphaService',
        injections: [{ id: BetaService, name: 'beta' }],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      Container.of('container-try-get').register({
        id: BetaService,
        Class: BetaService,
        name: 'BetaService',
        injections: [{ id: AlphaService, name: 'alpha' }],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      expect(() => Container.of('container-try-get').tryGet(AlphaService)).toThrow(CircularDependencyError);
    });
  });

  describe('dispose', () => {
    test('awaits disposal of cached services and bound values, then makes the container unusable', async () => {
      const requestContainer = Container.of('container-dispose');
      const events: string[] = [];

      class DisposableBinding {
        public async dispose() {
          events.push('binding');
        }
      }

      class DisposableService {
        public async dispose() {
          events.push('service');
        }
      }

      requestContainer.register({
        id: DisposableService,
        Class: DisposableService,
        name: 'DisposableService',
        injections: [],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      requestContainer.set(DisposableBinding, new DisposableBinding());
      requestContainer.get(DisposableService);

      await requestContainer.dispose();

      expect(events).toEqual(['binding', 'service']);
      expect(() => requestContainer.get(DisposableService)).toThrow(ContainerDisposedError);
      expect(() => requestContainer.tryGet(DisposableService)).toThrow(ContainerDisposedError);
      expect(() => requestContainer.set('value', 1)).toThrow(ContainerDisposedError);
      expect(() => requestContainer.has(DisposableBinding)).toThrow(ContainerDisposedError);
    });

    test('detaches disposed containers so the same id can be recreated later', async () => {
      const first = Container.of('container-dispose-recreate');

      await first.dispose();

      const recreated = Container.of('container-dispose-recreate');

      expect(recreated).not.toBe(first);
      expect(() => first.get('missing')).toThrow(ContainerDisposedError);
      expect(recreated.tryGet('missing')).toBeUndefined();
    });

    test('is idempotent', async () => {
      const requestContainer = Container.of('container-dispose');

      await requestContainer.dispose();
      await expect(requestContainer.dispose()).resolves.toBeUndefined();
    });

    test('recreates the default container after disposal', async () => {
      const first = Container.of();

      class DisposableService {
        public dispose() {}
      }

      first.register({
        id: DisposableService,
        Class: DisposableService,
        name: 'DisposableService',
        injections: [],
        scope: 'container',
        value: EMPTY_VALUE,
      });

      first.get(DisposableService);
      await first.dispose();

      const recreated = Container.of();

      expect(recreated).not.toBe(first);
      expect(() => first.get(DisposableService)).toThrow(ContainerDisposedError);
      expect(recreated.tryGet(DisposableService)).toBeUndefined();
    });

    test('disposes descendant containers when a parent is disposed', async () => {
      const parent = Container.of('hierarchy-dispose-parent');
      const child = parent.ofChild('hierarchy-dispose-child');

      parent.set('value', 1);

      await parent.dispose();

      expect(() => child.get('value')).toThrow(ContainerDisposedError);
      expect(() => parent.get('value')).toThrow(ContainerDisposedError);
    });
  });
});
