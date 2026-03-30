import { afterEach, describe, expect, test } from 'bun:test';
import { Container, Service } from '../../src';
import { ServiceNotFoundError } from '../../src/errors';
import { ContainerRegistry } from '../../src/container/registry';
import { Token } from '../../src/tokens';

const CONTAINER_IDS = ['service-singleton-container'] as const;

afterEach(() => {
  Container.of().reset('service');

  for (const id of CONTAINER_IDS) {
    if (ContainerRegistry.hasContainer(id)) {
      ContainerRegistry.removeContainer(id);
    }
  }
});

describe('Service decorator', () => {
  describe('@Service()', () => {
    test('registers a decorated class in the default container', () => {
      @Service()
      class TestService {}

      expect(Container.of().get(TestService)).toBeInstanceOf(TestService);
    });
  });

  describe('@Service({ id })', () => {
    test('supports custom service identifiers', () => {
      @Service({ id: 'custom-service' })
      class NamedService {}

      expect(Container.of().get('custom-service')).toBeInstanceOf(NamedService);
      expect(() => Container.of().get(NamedService)).toThrow(ServiceNotFoundError);
    });
  });

  describe('@Service({ scope })', () => {
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

  describe('@Service({ multiple: true })', () => {
    test('appends decorated services to a multi-binding group', () => {
      interface Logger {
        name: string;
      }

      const LOGGER = new Token<Logger>('Logger');

      @Service({ id: LOGGER, multiple: true })
      class ConsoleLogger implements Logger {
        public name = 'console';
      }

      @Service({ id: LOGGER, multiple: true })
      class FileLogger implements Logger {
        public name = 'file';
      }

      const loggers = Container.of().getMany(LOGGER);

      expect(loggers).toHaveLength(2);
      expect(loggers[0]).toBeInstanceOf(ConsoleLogger);
      expect(loggers[1]).toBeInstanceOf(FileLogger);
    });
  });
});
