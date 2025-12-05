# LSP Services

Code in this folder owns every `@lspService` that talks to VS Code via the Language Server Protocol. These classes expose user facing features such as diagnostics, code actions, completions, formatting, and upgrade guidance. The DI wiring for this layer lives in `src/server/modules/lsp.module.ts` so new handlers only need to import their dependencies and add themselves to that module.

## Subfolders

- `code-actions/`: helpers that build Stylelint specific quick fixes and fix-all commands.
- `__tests__/`: unit tests that exercise the public behaviour of the LSP services without booting the full server.
