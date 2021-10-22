---
name: "\U0001F41B Report a bug"
about: "Is something not working as you expect?"
---

<!-- Please answer the following. We close issues that don't. -->

> Clearly describe the bug

e.g. "An error occurred when ..."

> What code is needed to reproduce this issue?

e.g.

```css
.foo {
  color: pink;
}
```

> What vscode-stylelint configuration is needed to reproduce the bug?

```json
"stylelint.customSyntax": "${workspaceFolder}/custom-syntax.js",
"editor.codeActionsOnSave": {
  "source.fixAll.stylelint": true
}
```

> Is this issue related to autofix? (`editor.codeActionsOnSave`)

e.g. "Yes"

> Which version of vscode-stylelint are you using?

e.g. `0.84.0`

> Which version of Stylelint are you using?

e.g. `13.2.0`

> Does your issue relate to non-standard syntax (e.g. SCSS, nesting, etc.)?

e.g. "Yes, it's related to SCSS nesting."

> What did you expect to happen?

e.g. "No warnings to be flagged."

> What actually happened (e.g. what warnings or errors you are getting)?

e.g. "The following warnings were flagged:"

<!-- If the bug can be reproduced using the Stylelint CLI, e.g. `npx stylelint "src/**/*.css"`, please create the issue in the Stylelint issue tracker (https://github.com/stylelint/stylelint/issues/new?template=REPORT_A_BUG.md) instead. -->
