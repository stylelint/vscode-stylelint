# `src`

Only main entry points, whether for the client or server, should be in this directory. Modules should be organized in subdirectories.

Subdirectories should have the following structure (see [`utils`](utils) for an example):

- `src`
  - `group` — Group of modules, organized by purpose or functionality.
    - `__mocks__` — Optional, should contain mocks for any modules that need a more elaborate, reusable mock.
      - `sub-module-a.js`
      - …
    - `__tests__` — Required, unit tests for each module. Each test should have the same filename as the module it tests.
      - `sub-module-a.js`
      - `sub-module-b.js`
      - …
    - `index.js` — Entry point for the group. Should not contain any logic.
    - `sub-module-a.js`
    - `sub-module-b.js`
    - …

Submodules should always export their functionality as a single object, like so:

<!-- prettier-ignore -->
```js
'use strict';

/**
 * Parses Stylelint warnings into …
 * @param {stylelint.Warning[]} warnings The warnings to parse.
 * @returns {ParsedWarning[]} The parsed warnings.
 */
function parseWarnings(warnings) {
	// …
}

module.exports = {
	parseWarnings,
};
```

Group entry points should be named `index.js` and should export a single object, like so:

<!-- prettier-ignore -->
```js
'use strict';

module.exports = {
	...require('./sub-module-a'),
	...require('./sub-module-b'),
	// …
};
```

All modules should be documented using JSDoc comments, as seen in the example above. See [`server/server.js`](server/server.js) for a real-life example.
