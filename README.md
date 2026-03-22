# navi-di

`navi-di` is a dependency injection library built for standard ECMAScript decorators.

## Installation

`navi-di` can be installed with any common JavaScript package manager:

```sh
npm install navi-di
pnpm add navi-di
yarn add navi-di
bun add navi-di
```

The current implementation focuses on a compact core:

- `@Service()` registers classes in the default container.
- `@Inject()` wires decorated class fields from the active container.
- `Container.of()` resolves services from the default container or from named containers.
- `singleton`, `container`, and `transient` scopes control instance lifetime.
- Circular graphs and missing services fail with explicit runtime errors.

## What is implemented today

The repository is no longer just scaffolding. The source and tests currently cover:

- class registration through `@Service()`;
- field injection through `@Inject()`;
- named containers via `Container.of(id)`;
- default-container fallback for named containers;
- per-container caching for `container` scope;
- shared instances for `singleton` scope;
- fresh instances for `transient` scope;
- cache reset and registration reset through `container.reset()`;
- error handling for circular dependencies, missing services, and invalid container operations.

## Requirements

- Runtime target: Node.js `>=18.18`
- Local development toolchain: Bun `>=1.3.0`
- Language target: TypeScript 5 style standard decorators
- Module format: ESM

No environment variables or external services are required for local development.

## Public entry points

The package root currently exports runtime values and TypeScript types.

Runtime exports:

- `Container`
- `Service`
- `Inject`
- `Token`

Type-only exports:

- `Constructable` / `AbstractConstructable`
- `ServiceIdentifier`

## Quick start

```ts
import { Container, Inject, Service } from 'navi-di';

@Service()
class LoggerService {
  public log(message: string) {
    console.log(message);
  }
}

@Service()
class HandlerService {
  @Inject(LoggerService)
  public logger!: LoggerService;
}

const handler = Container.of().get(HandlerService);

handler.logger.log('hello from navi-di');
```

How resolution works:

1. `@Service()` stores the class metadata in the default container.
2. `@Inject()` records which decorated fields should be resolved.
3. `Container.of().get(HandlerService)` creates `HandlerService`.
4. The container resolves each injected field from the same container instance.

## Service lifetimes

`navi-di` currently supports three scopes.

### `container`

The default scope. One instance is cached per container.

- repeated `get()` calls in the same container reuse the same instance;
- named containers receive their own isolated instance;
- named containers lazily clone container-scoped registrations from the default container on first access.

### `singleton`

One shared instance across all containers.

- singleton registrations are effectively stored in the default container;
- resolving the same singleton from a named container returns the same shared instance as the default container.

### `transient`

A new instance is created on every `get()` call.

## Named containers

Use named containers when you want isolated request, job, or unit-of-work state.

```ts
const requestA = Container.of('request-a');
const requestB = Container.of('request-b');
```

Current behavior:

- `Container.of()` and `Container.of('default')` return the same default container;
- `Container.of('name')` reuses the same named container for the same id;
- named containers fall back to registrations stored in the default container;
- `container` scope becomes container-local after first resolution in a named container;
- `singleton` scope stays shared across the whole registry.

## Decorators

### `@Service(idOrOptions?)`

Registers a class in the default container.

Accepted forms today:

- `@Service()`
- `@Service(id)`
- `@Service({ id, scope })`

Options supported today:

- `id?: ServiceIdentifier`
- `scope?: 'singleton' | 'container' | 'transient'`

Example with a custom id:

```ts
import { Container, Service } from 'navi-di';

@Service({ id: 'logger', scope: 'singleton' })
class LoggerService {}

const logger = Container.of().get('logger');
```

Custom identifiers work for both `container.get(...)` and `@Inject(...)`.
When you use `Token` instances, resolution is based on object identity, so create the token once and reuse the same instance everywhere.

### `@Inject(dependency)`

Marks a decorated class field for property injection.

Current characteristics:

- injection is property-based, not constructor-based;
- services are instantiated with `new Class()` and therefore must be resolvable without constructor arguments;
- dependencies are resolved from the active container;
- multiple decorated fields on the same class are supported;
- injected fields are defined as writable and configurable own properties on the created instance;
- injected fields are assigned after construction, so they are not available inside constructors or field initializers.

Token example:

```ts
import { Container, Inject, Service, Token } from 'navi-di';

interface Logger {
  log(message: string): void;
}

const LOGGER = new Token<Logger>('Logger');

@Service(LOGGER)
class ConsoleLogger implements Logger {
  public log(message: string) {
    console.log(message);
  }
}

@Service()
class HandlerService {
  @Inject(LOGGER)
  public logger!: Logger;
}

const handler = Container.of().get(HandlerService);

handler.logger.log('hello from token injection');
```

## Container API

### `Container.of(id?)`

Returns the default container or a named container.

### `container.get(id)`

Resolves a service by class or service identifier.

Throws:

- `ServiceNotFoundError` when no registration exists;
- `CircularDependencyError` when the current resolution path loops back to an in-progress dependency.

### `container.has(id)`

Checks whether the current container has a local registration.

For named containers, this does not report default-container registrations until the service has been materialized locally.

In practice, that means `has()` becomes `true` after first resolution for `container`-scoped services, but can remain `false` for `singleton` and `transient` services resolved through fallback.

### `container.reset(strategy?)`

Supported strategies:

- `'value'` clears cached instances but keeps registrations;
- `'service'` removes registrations from the current container.

This is especially useful in tests.

### `container.set(metadata)`

Registers or replaces service metadata for a service identifier.

This is a low-level API that powers manual registration scenarios and internal tests.
For application-facing code, prefer `@Service()` unless you specifically need to construct metadata yourself.

## Internal architecture

The implementation is intentionally small and split into a few focused modules:

- `src/decorators/` records decorator metadata for services and injected fields.
- `src/container/container.ts` stores service metadata and performs resolution.
- `src/container/registry.ts` owns the default container and named-container registry.
- `src/types/` defines service identifiers, scopes, metadata, and injection metadata.
- `src/errors/` provides explicit runtime error classes.
- `test/` exercises registration, scoping, fallback behavior, reset behavior, and error paths.

Resolution flow at a high level:

1. decorators attach injection metadata through `context.metadata`;
2. `@Service()` registers the class and its collected injections in the default container;
3. `container.get()` loads registration metadata, handles scope rules, and creates the instance;
4. each injected field is resolved recursively from the same container after instance construction;
5. the container tracks the current resolution path to detect circular dependencies.

## Development

Install dependencies:

```sh
bun install
```

Available scripts:

```sh
bun run build
bun run typecheck
bun run test
bun run lint
bun run fmt
bun run fmt:check
bun run hooks:install
bun run hooks:validate
bun run hooks:run:pre-commit
```

What they do:

- `build`: compile the package with `tsc -p tsconfig.build.json`
- `typecheck`: run the TypeScript compiler in check mode
- `test`: run Bun tests
- `lint`: run `oxlint` with warnings denied
- `fmt`: format the repository with `oxfmt`
- `fmt:check`: verify formatting without writing changes
- `hooks:*`: install, validate, or run the repo-local Lefthook Git hooks

Git hooks are optional and repo-local. After cloning, contributors can install them with `bun run hooks:install`.

Current note: `typecheck` uses `tsconfig.json` with `noEmit: true`, while `build` uses `tsconfig.build.json` with `noEmit: false` to emit `dist/` and declaration files.

## Local quality gates

The repository currently enforces:

- strict TypeScript checking;
- `oxlint` for linting;
- `oxfmt` for formatting;
- PR CI checks for lint, format, typecheck, tests, and build;
- optional Lefthook `pre-commit` checks for staged TypeScript, JavaScript, Markdown, YAML, and YML files.

The package `prepack` script runs lint, format check, typecheck, and build before publishing.

## Repository layout

```text
src/
  container/
  decorators/
  errors/
  types/
test/
dist/
```

- `src/` contains the library source.
- `test/` contains Bun test coverage for the runtime behavior.
- `dist/` contains the built ESM output and declaration files emitted by `tsconfig.build.json`.

## Community

- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- License: [LICENSE](./LICENSE)
