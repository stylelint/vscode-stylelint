# Releasing

This is a guide for maintainers.

Releasing a new version follows the [standardized workflow](https://stylelint.io/maintainer-guide/releases) across the Stylelint organization. This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add changesets during development.

## Steps

1. Trigger the `Release PR` workflow to create a release PR. This consumes any pending changesets, bumps versions, and updates changelogs.
2. Review and merge the release PR. Publishing and GitHub releases are created automatically.
3. Confirm that the new version is available:
   - **Extension**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint)
   - **Language server**: [npm](https://www.npmjs.com/package/@stylelint/language-server)

That's all.
