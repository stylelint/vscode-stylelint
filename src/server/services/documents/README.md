# Document Services

Document services cache lint diagnostics and prepare the edits that Stylelint can apply to a single buffer. They do not talk to the LSP connection directly; instead the LSP layer (e.g. `ValidatorLspService` and `CodeActionService`) composes them.

Registered through `documentsModule` so contributors can add new document-scoped utilities without touching the LSP bootstrap.
