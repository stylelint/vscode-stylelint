# @stylelint/language-server

The [Stylelint](https://stylelint.io/) language server, providing lint diagnostics, code actions, and more via the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

## Usage

### As a standalone server

Install the package globally or use `npx`:

```sh
npx @stylelint/language-server --stdio
```

The server communicates over stdio by default. Stylelint must be installed in the project you're linting. The language server resolves it from the workspace directory automatically.

### As a library

```ts
import { createConnection, ProposedFeatures } from "vscode-languageserver";
import { StylelintLanguageServer } from "@stylelint/language-server";

const connection = createConnection(ProposedFeatures.all);

const server = new StylelintLanguageServer({
  connection,
  logLevel: "info"
});

server.start();
```

## Configuration

The server accepts configuration via LSP `workspace/configuration` requests. See the [vscode-stylelint documentation](https://github.com/stylelint/vscode-stylelint#readme) for available settings.

## License

[MIT](LICENSE)
