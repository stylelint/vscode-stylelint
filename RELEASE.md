# Releasing

This is a guide for maintainers.

To release a new version, take the following steps:

1. Check if the latest CI is successful on [GitHub Actions](https://github.com/stylelint/vscode-stylelint/actions/workflows/testing.yml).
2. Create a pull request to prepare the release, determining a new version and updating the changelog. E.g., "Prepare 1.0.0"
3. Merge the pull request it it's approved.
4. Wait until the latest CI is completed.
5. Run the releasing workflow with a new version input on [GitHub Actions](https://github.com/stylelint/vscode-stylelint/actions/workflows/releasing.yml) if there is no problems on the CI.
6. Confirm that the new version is available on [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint).
