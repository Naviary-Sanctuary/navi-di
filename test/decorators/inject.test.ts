import { afterEach, describe, expect, test } from 'bun:test';
import { Container, Inject, Service, Token } from '../../src';
import { ContainerRegistry } from '../../src/container/registry';

afterEach(() => {
  Container.of().reset('service');
  ContainerRegistry.removeContainer('inject-named-container');
});

describe('Inject Decorator', () => {
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
});
