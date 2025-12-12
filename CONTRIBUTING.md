# Contributing to vscode-stylelint

This guide is written for people who want to work on the internals of `vscode-stylelint`, with a particular focus on the language server. It assumes you are comfortable with TypeScript and basic VS Code extension concepts, but new to this codebase.

The aim is not to describe every file, but to give you enough mental models and concrete entry points that you can be productive quickly. It is deliberately example-driven rather than exhaustive.

If you want a quick overview, the [organization](#1-how-the-project-is-organised), [development workflow](#2-everyday-development-workflow), and [new service example](#8-worked-example-adding-a-new-service) sections are the best places to start.

> [!NOTE]
> If you ever need a deeper architectural explanation of how everything hangs together, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Table of contents

- [1. How the project is organised](#1-how-the-project-is-organised)
- [2. Everyday development workflow](#2-everyday-development-workflow)
- [3. Dependency injection: how services are wired together](#3-dependency-injection-how-services-are-wired-together)
  - [3.1 Tokens and classes](#31-tokens-and-classes)
  - [3.2 Declaring injection with decorators](#32-declaring-injection-with-decorators)
  - [3.3 Grouping providers into modules](#33-grouping-providers-into-modules)
  - [3.4 Creating and using a container in tests](#34-creating-and-using-a-container-in-tests)
- [4. How the server and extension use DI and decorators](#4-how-the-server-and-extension-use-di-and-decorators)
  - [4.1 Platform modules](#41-platform-modules)
  - [4.2 Application and runtime](#42-application-and-runtime)
  - [4.3 LSP decorators](#43-lsp-decorators)
- [5. Working with tests](#5-working-with-tests)
  - [5.1 Where tests live and how to run them](#51-where-tests-live-and-how-to-run-them)
  - [5.2 Unit tests and DI-heavy code](#52-unit-tests-and-di-heavy-code)
  - [5.3 Using shared stubs instead of ad-hoc mocks](#53-using-shared-stubs-instead-of-ad-hoc-mocks)
  - [5.4 Choosing the right level of test](#54-choosing-the-right-level-of-test)
- [6. Exporting services from index files](#6-exporting-services-from-index-files)
- [7. Putting it all together](#7-putting-it-all-together)
- [8. Worked example: adding a new service](#8-worked-example-adding-a-new-service)
  - [8.1 Sketching the data flow](#81-sketching-the-data-flow)
  - [8.2 Defining the service class](#82-defining-the-service-class)
  - [8.3 Exporting the service from its index file](#83-exporting-the-service-from-its-index-file)
  - [8.4 Registering the service in a module](#84-registering-the-service-in-a-module)
  - [8.5 Letting the runtime discover the handler](#85-letting-the-runtime-discover-the-handler)
  - [8.6 Adding the extension command](#86-adding-the-extension-command)
  - [8.7 Testing the service](#87-testing-the-service)

## 1. How the project is organised

The codebase is split into three broad areas.

The first is the VS Code-facing extension in `src/extension/`. This is the part that VS Code loads. It is responsible for activation, starting the language server process, and exposing commands on the VS Code side. You generally touch this layer when you add new user-facing commands, configuration points, or integration with VS Code APIs such as notifications and status items.

The second is the language server in `src/server/`. This is a standalone process that speaks the Language Server Protocol (LSP) and runs Stylelint on documents. Inside `src/server/`, the `runtime` directory contains the runtime features that bind into the LSP `Connection`, `modules` groups services, and `services` contains the actual behaviours, such as workspace, Stylelint running, logging, etc.

The third is the DI framework in `src/di/`, used throughout the server and in the extension. It provides the building blocks for declaring, grouping, and instantiating services, and is what supports the runtime lifecycle hooks. It manages dependencies and lifecycles so that contributors can focus on implementing features instead of wiring.

As mentioned above, the language server runs as a separate process. The extension simply launches it and forwards LSP messages, which means that most interesting work happens on the server side. Therefore, most of this guide focuses on working with the server.

## 2. Everyday development workflow

After cloning the repository, install dependencies and build the project once:

```bash
npm install
npm run build
```

From there, most contributions follow the same rhythm. You make a focused change, get fast feedback while you work, check that the pieces still fit together inside this repository, and then check that the packaged extension behaves correctly when VS Code actually loads it. Before you open a pull request you run the same kinds of checks that CI will, so there are no surprises.

The commands below are organised around that flow rather than listed exhaustively. They are the toolkit you reach for during a typical edit-run-iterate workflow.

For fast feedback while you are editing, you usually rely on your IDE's TypeScript integration. You can also keep a build running:

- `npm run build` compiles the TypeScript sources once. It is useful after changing build-time types or when you want to be sure the project compiles cleanly.
- `npm run build-watch` keeps `tsc` running in watch mode so compile errors show up quickly as you edit.

For repository-level tests that do not involve a real VS Code instance, you normally work with the unit and integration suites:

- `npm run test:unit` runs the unit test suite under `src/**/__tests__/`. This answers "does this module behave correctly in isolation?".
- `npm run test:unit -- <path>` narrows that to a subset of tests, for example `src/di` or `src/server/services/workspace`. This is often the main command you use while iterating on a change.
- `npm run test:integration` runs the integration tests under `test/integration/`, which exercise multiple components together (for example, the extension and server processes talking to one another). Use this when you change wiring, configuration, or anything that spans different parts of the codebase.
- `npm run test` builds, bundles, and then runs both unit and integration tests. It gives you confidence that all code-level tests pass, but it still runs everything inside a controlled Node.js environment, not a live VS Code session.

To answer the question "does this extension behave correctly when VS Code loads it the way users do?", use the end-to-end suite:

- `npm run test:e2e` starts a controlled instance of VS Code, installs the built extension, and runs the tests under `test/e2e/`. This is the safety net for the full extension lifecycle: activation events, contributed commands, configuration, client/server startup, and anything else that might behave differently once VS Code is in the loop.

Since the extension supports older versions of Stylelint, you should also test that the extension and server behave correctly with those older versions.

- `npm run switch-stylelint [version]` changes the Stylelint version used by both the extension and the tests.  
  For example, `npm run switch-stylelint 16` makes the extension use Stylelint 16.x. You can then run any of the test commands above to verify behaviour with that version.  
  `npm run switch-stylelint` without arguments switches back to the default version defined in `package.json`.  
  Run `npm run switch-stylelint -- --help` for details.

> [!NOTE]
> For more information on testing, see [section 5](#5-working-with-tests).

Finally, to keep the codebase consistent and healthy, there are a couple of formatting and linting entry points:

- `npm run format` runs Prettier over the repo and writes changes.
- `npm run lint` runs the full lint pipeline: type checking, ESLint, formatting check, spelling, and the unit-test mapping check.

The more granular lint scripts such as `lint:js`, `lint:formatting`, or `lint:unit-tests` are mainly useful when you want to re-run a single check that is already failing, without running the entire `lint` pipeline.

A typical development workflow might look like this:

```bash
# Once you get started for the first time, or when you have made changes that affect dependencies:
npm install

# Check that the project builds cleanly:
npm run build

# While working in a specific area:
npm run test:unit -- src/di

# When needing to verify that interactions between components still work correctly:
npm run test:integration

# When needing to verify that the extension and language server behave correctly in a live VS Code session:
npm run test:e2e

# Before pushing or opening a PR, run the same checks as CI:
npm run test
npm run lint
npm run test:e2e
```

The `lint:unit-tests` script is strict: for each module under `src/`, it expects a corresponding unit test file with the same base name plus a `.test` suffix in a sibling `__tests__` directory. For example, `src/server/runtime/application.ts` must have `src/server/runtime/__tests__/application.test.ts`. If you add a new module and forget the test file, this script will fail.

For files that do not need unit tests, such as simple exports of types or constants, you can add a comment like this at the top of the file to exempt it:

```ts
// @no-unit-test -- Write the reason this file does not need unit tests here.
```

## 3. Dependency injection: how services are wired together

> [!TIP]
> If you want to skip straight to a concrete example of adding a new service, jump to [section 8](#8-worked-example-adding-a-new-service).

Almost everything in `src/server/` is created and connected via a small DI framework in `src/di/`. The point of this system is to keep wiring separate from behaviour so that services can focus on what they do, not how they are constructed.

For day-to-day work, you do not need to understand every detail of the DI implementation. You mainly need to recognise a few patterns you will see and use when you add or change behaviour.

- **Services** are classes that do work, such as `WorkspaceOptionsService`, `StylelintRunnerService`, or document services. They are the main place you will add new behaviour.
- **Tokens** are used when a service needs something that is not just another class, for example VS Code APIs, the LSP connection, or the `winston` logging library.
- **Modules** are small bundles that register services and tokens so the application knows they exist.

> [!NOTE]
> For a fuller discussion of the DI system and how it fits into the overall architecture, see the [architectural overview](ARCHITECTURE.md).

### 3.1 Tokens and classes

Most of the time, services depend on other services purely through their constructors. For example, `WorkspaceOptionsService` depends on helpers such as the Stylelint runner and file-system helpers.

When you need to depend on external things, such as platform APIs or third-party libraries, those are surfaced as tokens defined near the code that owns them. Some examples you will see in the codebase:

- `src/server/tokens.ts` centralises LSP-level primitives such as `textDocumentsToken` and `lspConnectionToken`.
- `src/server/services/infrastructure/logging.service.ts` defines `winstonToken` so the server can swap between the real `winston` instance and a fake in tests.
- `src/extension/di-tokens.ts` wraps VS Code objects such as `Window`, `Commands`, and `Workspace` so the extension can stub or override them in integration tests.

As a contributor, you will usually:

- inject other services by adding constructor parameters; and
- reach for a token only when you truly need a host API or library that is not already a decorated class.

### 3.2 Declaring injection with decorators

The `@inject` decorator in `src/di/inject.ts` makes classes resolvable by the container. It records which tokens or classes should be passed to the constructor.

At a high level, the pattern looks like this:

```ts
@inject({
  inject: [SomeService, SomeToken]
})
export class MyFeatureService {
  #someService: SomeService;
  #someValue: SomeValueFromAToken;

  public constructor(someService: SomeService, someValue: SomeValueFromAToken) {
    this.#someService = someService;
    this.#someValue = someValue;
  }
}
```

Real services such as `ExtensionRuntimeService` in `src/extension/extension-runtime.service.ts` or `WorkspaceOptionsService` in `src/server/services/workspace/workspace-options.service.ts` follow exactly this pattern. They declare what dependencies they need, the DI container constructs them, and the rest of your code calls their public methods.

By default, services are singletons - that is, one instance per application - which is what you almost always want. Transient services exist, but you rarely need them for normal feature work.

### 3.3 Grouping providers into modules

Modules gather related providers. In practice, you will encounter modules in two main places:

- the main server and extension modules under `src/server/modules/` and `src/extension/`, where you register real services; and
- tiny test modules that create just enough wiring to exercise the behaviour you care about.

Here is a typical test module pattern you will see in this repository:

```ts
const testModule = module({
  register: [
    provideTestValue(SomeDependency, () => fakeDependency),
    MyFeatureService
  ]
});
```

For production wiring, modules under `src/server/modules/` follow the same idea but register real services instead of fakes. When you add a new service under `src/server/services/`, you will usually also add it to one of these modules so the language server can discover it.

### 3.4 Creating and using a container in tests

In production, the runtime helpers `createRuntimeApplication()` and `createLanguageServerApplication()` build the container for you. You almost never construct a container by hand outside of tests.

In unit tests, however, creating a small container is a very common pattern:

```ts
const testModule = module({
  register: [
    provideTestValue(SomeDependency, () => fakeDependency),
    MyFeatureService
  ]
});

const container = createContainer(testModule);
const service = container.resolve(MyFeatureService);
```

This mirrors the way services are built in production, but with a much smaller graph. The tests in `src/server/services/**/__tests__/` contain many real examples of this pattern.

## 4. How the server and extension use DI and decorators

Now that you have a feel for the DI building blocks, this section focuses on how you will actually use them when you work on features.

At a high level:

- The extension side (`src/extension/`) is where you add VS Code commands, configuration points, and public API surface. It talks to the language server via LSP.
- The server side (`src/server/`) is where most Stylelint and LSP behaviour lives. You typically add or modify services here when changing diagnostics, code actions, or server-side commands.

### 4.1 Platform modules

Both halves of the project have a platform module that binds host APIs (VS Code, Node, LSP) to tokens:

- `src/extension/platform.module.ts` provides the VS Code `ExtensionContext`, window/commands/workspace facades, language client factories, and the setting monitor.
- `src/server/platform.module.ts` provides `TextDocuments`, core Node modules (`fs/promises`, `path`, `child_process`, etc.), and LSP helpers.

In normal day-to-day work you rarely need to edit these. If you ever need a new host API - for example, a VS Code surface that is not currently exposed - you would:

1. Add a new token next to the relevant code; and
2. Register that token in the appropriate platform module.

The rest of your code should continue to depend on tokens and services rather than importing host APIs directly.

### 4.2 Application and runtime

On both the extension and server side, the top-level entry points build a runtime application from the platform module plus feature modules, then start it:

- `src/extension/extension.ts` creates the extension application and wires up the language client and commands.
- `src/server/server.ts` creates the language-server application around an LSP connection and calls `listen()`.

For normal contributions you do not need to change this wiring. You plug new behaviour in by adding or modifying services under `src/server/services/` or `src/extension/`, and registering them in the existing modules under `src/server/modules/` or the extension module.

### 4.3 LSP decorators

Server-side services use decorators from `src/server/decorators.ts` to describe how they participate in the LSP lifecycle. This lets you express LSP handlers declaratively inside a service class instead of wiring them in a central file.

`@lspService()` marks a class as an LSP-aware runtime service, and method-level decorators declare which LSP requests, notifications, or document events a method should handle.

Common method-level decorators include:

- `@command(CommandId.X, { minArgs? })` to bind a method to a command handled by `CommandService`.
- `@textDocumentEvent("didChange" | "didOpen" | ...)` to react to document events.
- `@codeActionRequest()` and `@documentFormattingRequest()` for code actions and formatting.
- `@notification(NotificationType.X)` and `@request(RequestType.X)` for handling LSP messages.
- `@initialize()` and `@shutdown()` when you need to contribute to the LSP initialize result or perform cleanup.

When you add a new LSP-facing service, the practical steps are:

1. Decorate the class with both `@inject(...)` and `@lspService()`.
2. Use the method decorators that correspond to the LSP events you need.
3. Register the class inside the appropriate module under `src/server/modules/`.

Once you have done this, the language server runtime will discover and register your handlers automatically. You do not need to edit any central connection wiring. The worked example in [section 8](#8-worked-example-adding-a-new-service) walks through this pattern end-to-end.

## 5. Working with tests

Tests in this repository are there to give you confidence as you change the codebase, not to mirror every internal detail. This section focuses on how to use them effectively while you work.

### 5.1 Where tests live and how to run them

Most test files live next to the code they exercise:

- **Unit tests** live under `src/**/__tests__/` and use the naming pattern `<module>.test.ts`.
- **Integration tests** live under `test/integration/` and cover interactions between larger pieces, such as the extension and server processes.
- **End-to-end tests** live under `test/e2e/` and drive a real VS Code instance through `scripts/run-e2e.js`.

The `lint:unit-tests` script enforces the "one module, one unit test file" rule for everything under `src/`. When you add a new module, expect to add a matching unit test, unless you deliberately opt out with the `@no-unit-test` pragma described earlier.

In day-to-day work you will mostly run targeted tests that match the kind of change you are making. For example, while iterating on a specific module or folder you might use `npm run test:unit -- src/...`. When you touch wiring between components or DI modules, `npm run test:integration` is more helpful. And when you change how the extension behaves inside VS Code itself, you should run `npm run test:e2e`.

Running `npm run test` before you push gives you a single command that builds, bundles, and runs both the unit and integration suites. End-to-end tests are separate because they take longer and involve launching VS Code.

### 5.2 Unit tests and DI-heavy code

Many server-side services are created through the DI container rather than by calling constructors directly. In tests, you keep that wiring just realistic enough to exercise the behaviour you care about, without pulling in the entire runtime.

A common pattern for DI-heavy services looks like this:

1. Define a tiny test module with just the providers you need.
2. Use `createContainer()` (usually in `beforeEach`) to build a fresh container.
3. Resolve the subject under test from the container and call its public methods.

Here is a cut-down version of the `WorkspaceStylelintService` unit test that follows this pattern:

```ts
// src/server/services/stylelint-runtime/__tests__/workspace-stylelint.service.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  createLoggingServiceStub,
  createTestLogger
} from "../../../../../test/helpers/index.js";
import {
  createContainer,
  module,
  provideTestValue
} from "../../../../di/index.js";
import { loggingServiceToken } from "../../infrastructure/logging.service.js";
import { PackageRootCacheService } from "../package-root-cache.service.js";
import { PnPConfigurationCacheService } from "../pnp-configuration-cache.service.js";
import { WorkerRegistryService } from "../worker-registry.service.js";
import { WorkspaceStylelintService } from "../workspace-stylelint.service.js";

describe("WorkspaceStylelintService", () => {
  let service: WorkspaceStylelintService;
  let worker: { lint: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    worker = { lint: vi.fn() };

    const workerRegistry = {
      runWithWorker: vi.fn(async (_ctx, executor) => executor(worker as never))
    } as unknown as WorkerRegistryService;

    const packageRootCache = {
      determineWorkerRoot: vi.fn().mockResolvedValue("/workspace")
    } as unknown as PackageRootCacheService;

    const pnpCache = {
      findConfiguration: vi.fn().mockResolvedValue(undefined)
    } as unknown as PnPConfigurationCacheService;

    const loggingService = createLoggingServiceStub(createTestLogger());

    const testModule = module({
      register: [
        provideTestValue(loggingServiceToken, () => loggingService),
        provideTestValue(PackageRootCacheService, () => packageRootCache),
        provideTestValue(PnPConfigurationCacheService, () => pnpCache),
        provideTestValue(WorkerRegistryService, () => workerRegistry),
        WorkspaceStylelintService
      ]
    });

    const container = createContainer(testModule);
    service = container.resolve(WorkspaceStylelintService);
  });

  test("delegates lint requests to the worker registry", async () => {
    worker.lint.mockResolvedValue({});

    await service.lint({
      workspaceFolder: "/workspace",
      options: { codeFilename: "/workspace/file.css" },
      runnerOptions: {}
    } as never);

    expect(worker.lint).toHaveBeenCalled();
  });
});
```

This test mirrors how the service is wired in production: dependencies such as logging, the worker registry, and the caches are provided via DI, but each is replaced with a small fake or stub. The single assertion stays focused on what `WorkspaceStylelintService` is supposed to do (delegate a lint request), not on internal implementation details.

### 5.3 Using shared stubs instead of ad-hoc mocks

Under `test/helpers/stubs/` you will find a small library of focused stubs for common services: logging, the Stylelint runner, public API events, and so on. These stubs:

- expose only the methods that production code relies on;
- record calls so you can assert on them; and
- often provide helper setters to preload canned results.

In the `WorkspaceStylelintService` example above, the logging dependency comes from `createLoggingServiceStub(createTestLogger())`, wired into the container via `provideTestValue(loggingServiceToken, () => loggingService)`. Other tests follow the same pattern with different stubs: they build a tiny module, plug in one or more helpers from `test/helpers/stubs/`, resolve the service, and then assert on its behaviour.

When you are about to introduce your own ad-hoc mock, it is worth scanning `test/helpers/stubs/` first. If a stub already exists for the service you need, using it keeps tests consistent and makes future refactors easier, because the stubs evolve with the real services.

### 5.4 Choosing the right level of test

Not every change needs every kind of test. If you are tweaking a pure helper, such as a small function under `src/server/utils/`, you will usually write or update a straightforward unit test that calls the function directly and asserts on the result. If you are changing a DI-backed service, for example a workspace or Stylelint runtime service, it is better to test it via a small container so that constructor injection and tokens behave the same way they do in production.

For changes that affect runtime and LSP wiring, focused tests under `src/server/runtime/__tests__/` and the integration suite under `test/integration/` are your friends. When you change how decorators behave or how handlers are registered, start by looking at these tests and extend them if necessary. Extension-side behaviour, such as commands, public API events, and language client wiring, is generally exercised through the integration and end-to-end suites rather than through deep mocks of VS Code APIs.

If you find yourself reaching for `vi.mock` or `vi.spyOn` on internal modules, it is often a sign that the dependency you care about is not yet expressed as a DI token or injectable class. In those cases, consider improving the wiring first so you can swap in a fake implementation cleanly. The result is usually simpler production code and more robust tests.

## 6. Exporting services from index files

Service directories under `src/server/services/` generally have an `index.ts` file that re-exports the concrete services in that folder. This makes it possible for modules under `src/server/modules/`, and other consumers, to import a cohesive group of services from one place instead of reaching into individual files.

As a concrete pattern, document-related services are re-exported from their folder index and then consumed by the corresponding module. A typical `index.ts` looks like this:

```ts
// src/server/services/documents/index.ts
export * from "./document-fixes.service.js";
// export * from "./other-document-service.service.js";
```

The module that wires these services into the server imports from the index rather than from individual files:

```ts
// src/server/modules/documents.module.ts
import { DocumentFixesService } from "../services/documents/index.js";
```

When you add a new service to a folder under `src/server/services/`, update that folder's `index.ts` to export it alongside the existing services, and adjust the module imports if necessary. This keeps imports consistent and makes it easy to see at a glance which services a folder exposes.

## 7. Putting it all together

When you add a new server-side capability, you are usually doing three things at once: defining a new service, registering it in a DI module, and writing a focused unit test under `__tests__` with a `.test` suffix.

If you keep the following mental checkpoints in mind, you will stay aligned with the existing structure:

- Every cross-cutting dependency that isn't a simple pure function should be expressed as either a class with `@inject` or a `createToken` symbol.
- Every new service should have a home module under `src/server/modules/` that registers it.
- Every new module under `src/` should come with a matching `<module>.test.ts` file under a sibling `__tests__` directory.
- Every service that participates in LSP events should be decorated with `@lspService()` and use the method decorators to declare its handlers.
- For anything that touches LSP internals, the runtime tests are your primary reference.

If you discover patterns that aren't documented here, or if any part of this guide makes a particular workflow harder rather than easier, please open a pull request or issue. The DI system and runtime are central to this project; keeping this guide accurate and concrete is as valuable as any code change.

## 8. Worked example: adding a new service

Here we will go through a concrete example: adding a new service on the language server that exposes a command to the extension. The example itself is simplified, but it follows the same basic steps you would take for a real feature.

Let's say you want a command that, when invoked from VS Code, asks the server to analyse the currently open document and return a short summary, for example, how many Stylelint warnings it would have. The details of the analysis do not matter here; the focus is how to hook everything up.

### 8.1 Sketching the data flow

Before writing any code, it helps to sketch the flow in terms of this project's building blocks:

1. The extension defines a VS Code command in `src/extension/` that sends an LSP request or command to the server.
2. The server declares a new command handler via `@command(...)` in a class marked with `@lspService()`.
3. That class is constructed via DI using `@inject`, so it can depend on other services such as `WorkspaceOptionsService` or `StylelintRunnerService`.
4. The class is registered in an appropriate module under `src/server/modules/`, so that `LanguageServerApplication` will see it when assembling modules.
5. `LanguageServerServiceRuntime` discovers the new handler and registers it with `CommandService`, which ultimately receives command invocations from the extension.

You do not need to touch the runtime wiring in `application.ts` or `lsp-service-runtime.ts` for this; they are designed so that you can plug in modules and services declaratively.

### 8.2 Defining the service class

Start on the server side by defining a new service class. For the sake of example, imagine we add `DocumentSummaryService` under `src/server/services/documents/`:

```ts
// src/server/services/documents/document-summary.service.ts
import { lspService, command } from "../../decorators.js";
import { inject } from "../../../di/index.js";
import { WorkspaceOptionsService } from "../workspace/workspace-options.service.js";
import { StylelintRunnerService } from "../stylelint-runtime/stylelint-runner.service.js";
import { CommandId } from "../../types.js";

@lspService()
@inject({
  inject: [WorkspaceOptionsService, StylelintRunnerService]
})
export class DocumentSummaryService {
  readonly #workspaceOptions: WorkspaceOptionsService;
  readonly #runner: StylelintRunnerService;

  public constructor(
    workspaceOptions: WorkspaceOptionsService,
    runner: StylelintRunnerService
  ) {
    this.#workspaceOptions = workspaceOptions;
    this.#runner = runner;
  }

  @command(CommandId.DocumentSummary, { minArgs: 1 })
  public async handle(uri: string): Promise<{ warnings: number }> {
    const options = await this.#workspaceOptions.getOptionsForUri(uri);
    const result = await this.#runner.runOnDocument(uri, options);

    return { warnings: result.warnings.length };
  }
}
```

Several project-specific patterns appear here:

- The class is both an LSP service (`@lspService`) and a DI target (`@inject`). The decorators work together: DI constructs the instance; initialization hooks from `@lspService` then register its handlers.
- Constructor dependencies are expressed as class types. Because both `WorkspaceOptionsService` and `StylelintRunnerService` are themselves registered in DI modules, the container can satisfy them.
- The `@command` decorator uses a `CommandId` from `src/server/types.ts`, which keeps server-facing command identifiers consistent across the codebase.
- The handler method signature is very close to business logic. It receives a URI and returns a structured object. The runtime wraps this in LSP plumbing when the command is invoked.

In a real implementation you would probably accept a more structured parameter than a bare URI, but the pattern is the same.

### 8.3 Exporting the service from its index file

Before the new service can be conveniently consumed elsewhere, update the `index.ts` file in the same folder to export it. This follows the general convention described earlier for service folders.

```ts
// src/server/services/documents/index.ts
export * from "./document-fixes.service.js";
export * from "./document-summary.service.js";
// export * from "./other-document-service.service.js";
```

With this in place, document-related modules can import a coherent set of services from a single entry point.

### 8.4 Registering the service in a module

Next, make sure the service is visible to the DI container by registering it in one of the server modules under `src/server/modules/`. Suppose document-related services are wired through `documents.module.ts`:

```ts
// src/server/modules/documents.module.ts
import { module } from "../../di/index.js";
import {
  DocumentFixesService,
  DocumentSummaryService
} from "../services/documents/index.js";
// other imports omitted

export const documentsModule = module({
  register: [
    // existing document services
    DocumentFixesService,
    DocumentSummaryService
  ]
});
```

There is no additional configuration needed here because `DocumentSummaryService` already carries its injection metadata via `@inject`. The call to `module({ register: [DocumentSummaryService] })` translates that metadata into a provider definition.

From this point on, any code that has access to the server's container can resolve `DocumentSummaryService` directly if it really needs to. In practice, you rarely do that manually; instead, the runtime focuses on the decorators.

### 8.5 Letting the runtime discover the handler

Once the service exists and is registered in a module, the rest of the wiring is handled for you. You do not need to hunt down the place where commands are registered or remember to add a case to a big switch statement.

When the language server starts, it discovers classes marked with `@lspService()`, reads the metadata from their method decorators, and registers the corresponding handlers with the underlying plumbing.

From the point of view of a contributor adding `DocumentSummaryService`, this means there is no extra registration step hidden somewhere else in the codebase. If the class is decorated with `@lspService()` and included in a module that feeds into the language server application, it will be discovered and made active automatically. Your job is to describe the behaviour in the service class; the runtime's job is to notice that description and connect it to the rest of the server.

### 8.6 Adding the extension command

On the extension side, commands are registered from `ExtensionRuntimeService` in `src/extension/extension-runtime.service.ts`. It receives the VS Code window, commands, workspace, context, and the language client, and uses them to set up the commands that users see.

Following the pattern used for `stylelint.executeAutofix`, a `DocumentSummaryService` command would be registered inside `ExtensionRuntimeService.#registerCommands()` roughly like this:

```ts
// inside ExtensionRuntimeService.#registerCommands()
const documentSummaryDisposable = this.#commands.registerCommand(
  "stylelint.documentSummary",
  async () => {
    const editor = this.#window.activeTextEditor;

    if (!editor) {
      return;
    }

    const uri = editor.document.uri.toString();

    const result = await this.#client.sendRequest<{ warnings: number }>(
      "workspace/executeCommand",
      {
        command: CommandId.DocumentSummary,
        arguments: [uri]
      }
    );

    void this.#window.showInformationMessage(
      `Stylelint found ${result.warnings} warnings in this document.`
    );
  }
);

this.#registerDisposable(documentSummaryDisposable);
```

The extension uses `workspace/executeCommand` and the shared `CommandId` enum to reach server commands so both sides agree on the identifier, and the human-facing VS Code command ID (`stylelint.documentSummary`) is what users bind in `keybindings.json`.

### 8.7 Testing the service

To keep `lint:unit-tests` happy and to lock in the behaviour, add a unit test under `src/server/services/documents/__tests__/document-summary.service.test.ts`. The test follows the same pattern as in section 5: build a tiny DI module, resolve the service from a container, and assert on its public behaviour.

```ts
// src/server/services/documents/__tests__/document-summary.service.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createContainer,
  module,
  provideTestValue
} from "../../../di/index.js";
import { DocumentSummaryService } from "../document-summary.service.js";
import { WorkspaceOptionsService } from "../../workspace/workspace-options.service.js";
import { StylelintRunnerService } from "../../stylelint-runtime/stylelint-runner.service.js";

describe("DocumentSummaryService", () => {
  let service: DocumentSummaryService;
  let workspaceOptions: WorkspaceOptionsService;
  let runner: StylelintRunnerService;

  beforeEach(() => {
    workspaceOptions = {
      getOptionsForUri: vi.fn().mockResolvedValue({})
    } as unknown as WorkspaceOptionsService;

    runner = {
      runOnDocument: vi.fn().mockResolvedValue({ warnings: [1, 2, 3] })
    } as unknown as StylelintRunnerService;

    const testModule = module({
      register: [
        provideTestValue(WorkspaceOptionsService, () => workspaceOptions),
        provideTestValue(StylelintRunnerService, () => runner),
        DocumentSummaryService
      ]
    });

    const container = createContainer(testModule);
    service = container.resolve(DocumentSummaryService);
  });

  test("reports warning count from StylelintRunnerService", async () => {
    const result = await service.handle("file:///test.css");

    expect(result.warnings).toBe(3);
    expect(workspaceOptions.getOptionsForUri).toHaveBeenCalledWith(
      "file:///test.css"
    );
  });
});
```

This test defines a small module, uses `beforeEach` to refresh fakes and build a fresh container, and keeps the assertion focused on the behaviour you care about: that, given a URI, the service asks for options, runs Stylelint, and reports the warning count.

With the test in place, `npm run test:unit -- src/server/services/documents` and `npm run lint:unit-tests` should both succeed.

---

This worked example is intentionally small, but the same wiring pattern applies to more complex features. You define or reuse tokens, decorate your service with `@inject` and optionally `@lspService`, register it in a module, and then integrate it with the extension via commands or notifications.

If you glance back at sections 3 and 4 now, you should recognise the pieces you just used: a service class, a module, LSP decorators, and a small test container.
