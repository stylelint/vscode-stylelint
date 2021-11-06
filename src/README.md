# `src`

No code should be in this directory. Modules should be organized in subdirectories.

Subdirectories should have the following structure (see [`utils`](utils) for an example):

- `src`
  - `package` — The package. At the moment, these aren't published.
    - `group` — Group of modules, organized by purpose or functionality.
      - `__mocks__` — Optional, should contain mocks for any modules that need a more elaborate, reusable mock.
        - `sub-module-a.ts`
        - …
      - `__tests__` — Required, unit tests for each module. Each test should have the same filename as the module it tests.
        - `sub-module-a.ts`
        - `sub-module-b.ts`
        - …
      - `index.ts` — Entry point for the group. Should not contain any logic.
      - `sub-module-a.ts`
      - `sub-module-b.ts`
      - …

Submodules should always export their functionality as a single object, like so:

```ts
/**
 * Parses Stylelint warnings into …
 * @param warnings The warnings to parse.
 * @returns The parsed warnings.
 */
export function parseWarnings(warnings: stylelint.Warning[]): ParsedWarning[] {
  // …
}
```

Group entry points should be named `index.ts` and should export a single object, like so:

<!-- prettier-ignore -->
```ts
export * from './sub-module-a';
export * from './sub-module-b';
// …
```

All modules should be documented using TSDoc comments, as seen in the example above. See [`server/server.ts`](server/server.ts) for a real-life example.
