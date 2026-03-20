import { afterEach, describe, expect, test } from 'bun:test';
import { Container } from '../../src';
import { ContainerDuplicatedError, DefaultContainerIdError } from '../../src/errors';
import { ContainerRegistry } from '../../src/container/registry';

afterEach(() => {
  Container.of().reset('service');
  ContainerRegistry.removeContainer('registry-duplicate');
  ContainerRegistry.removeContainer('registry-visible');
  ContainerRegistry.removeContainer('registry-removed');
});

describe('ContainerRegistry', () => {
  test('throws when registering another container with the same id', () => {
    Container.of('registry-duplicate');

    expect(() => ContainerRegistry.registerContainer(new Container('registry-duplicate'))).toThrow(
      ContainerDuplicatedError,
    );
  });

  test('reports named container presence through hasContainer and getContainer', () => {
    const container = Container.of('registry-visible');

    expect(ContainerRegistry.hasContainer('registry-visible')).toBe(true);
    expect(ContainerRegistry.getContainer('registry-visible')).toBe(container);
  });

  test('removes a named container from the registry', () => {
    Container.of('registry-removed');

    ContainerRegistry.removeContainer('registry-removed');

    expect(ContainerRegistry.hasContainer('registry-removed')).toBe(false);
    expect(ContainerRegistry.getContainer('registry-removed')).toBeUndefined();
  });

  test('throws when removing the default container', () => {
    expect(() => ContainerRegistry.removeContainer('default')).toThrow(DefaultContainerIdError);
  });
});
