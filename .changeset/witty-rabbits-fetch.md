---
"@stylelint/language-server": patch
---

Fixed: code action and completion requests now respect LSP cancellation tokens, responding with RequestCancelled per the LSP specification
