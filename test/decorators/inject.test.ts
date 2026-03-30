import { afterEach, describe, expect, test } from 'bun:test';
import { Container, Inject, InjectMany, Service, Token } from '../../src';
import { ContainerRegistry } from '../../src/container/registry';

const CONTAINER_IDS = ['inject-named-container', 'inject-many-container'] as const;

afterEach(() => {
  Container.of().reset('service');

  for (const id of CONTAINER_IDS) {
    if (ContainerRegistry.hasContainer(id)) {
      ContainerRegistry.removeContainer(id);
    }
  }
});

describe('Inject decorator', () => {
  describe('@Inject()', () => {
    test('injects a decorated dependency into a decorated class field', () => {
      @Service()
      class LoggerService {}

      @Service()
      class HandlerService {
        @Inject(LoggerService)
        public logger!: LoggerService;
      }

      const handler = Container.of().get(HandlerService);
      const descriptor = Object.getOwnPropertyDescriptor(handler, 'logger');

      expect(handler.logger).toBeInstanceOf(LoggerService);
      expect(handler.logger).toBe(Container.of().get(LoggerService));
      expect(descriptor).toMatchObject({
        configurable: true,
        writable: true,
        value: handler.logger,
      });
    });

    test('injects multiple decorated dependencies on the same class', () => {
      @Service()
      class LoggerService {}

      @Service()
      class MetricsService {}

      @Service()
      class HandlerService {
        @Inject(LoggerService)
        public logger!: LoggerService;

        @Inject(MetricsService)
        public metrics!: MetricsService;
      }

      const handler = Container.of().get(HandlerService);

      expect(handler.logger).toBe(Container.of().get(LoggerService));
      expect(handler.metrics).toBe(Container.of().get(MetricsService));
    });

    test('uses the current named container when resolving injected dependencies', () => {
      const requestContainer = Container.of('inject-named-container');

      @Service()
      class LoggerService {}

      @Service()
      class HandlerService {
        @Inject(LoggerService)
        public logger!: LoggerService;
      }

      const handler = requestContainer.get(HandlerService);

      expect(handler.logger).toBe(requestContainer.get(LoggerService));
      expect(handler.logger).not.toBe(Container.of().get(LoggerService));
    });

    test('injects a token-identified dependency into a decorated class field', () => {
      interface Logger {
        log(message: string): void;
      }

      const LOGGER = new Token<Logger>('Logger');

      @Service(LOGGER)
      class ConsoleLogger implements Logger {
        public log(_: string) {}
      }

      @Service()
      class HandlerService {
        @Inject(LOGGER)
        public logger!: Logger;
      }

      const handler = Container.of().get(HandlerService);

      expect(handler.logger).toBeInstanceOf(ConsoleLogger);
      expect(handler.logger).toBe(Container.of().get(LOGGER));
    });

    test('injects all token-identified dependencies into a decorated class field', () => {
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

      @Service()
      class HandlerService {
        @InjectMany(LOGGER)
        public loggers!: Logger[];
      }

      const handler = Container.of().get(HandlerService);

      expect(handler.loggers).toHaveLength(2);
      expect(handler.loggers[0]).toBeInstanceOf(ConsoleLogger);
      expect(handler.loggers[1]).toBeInstanceOf(FileLogger);
      expect(handler.loggers.map((logger) => logger.name)).toEqual(['console', 'file']);
      expect(handler.loggers).toEqual(Container.of().getMany(LOGGER));
    });

    test('resolves InjectMany from the active child container', () => {
      interface Logger {
        id: number;
      }

      const LOGGER = new Token<Logger>('RequestLogger');
      const requestContainer = Container.of('inject-many-container');

      Container.of().add(LOGGER, {
        useFactory: () => ({ id: Math.random() }),
        scope: 'container',
      });

      @Service()
      class HandlerService {
        @InjectMany(LOGGER)
        public loggers!: Logger[];
      }

      const handler = requestContainer.get(HandlerService);

      expect(handler.loggers).toEqual(requestContainer.getMany(LOGGER));
      expect(handler.loggers[0]).not.toBe(Container.of().getMany(LOGGER)[0]);
    });
  });
});
