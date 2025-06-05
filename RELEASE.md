# Releasing

This is a guide for maintainers.

To release a new version, take the following steps:

1. Check if the latest CI is successful on [GitHub Actions](https://github.com/stylelint/vscode-stylelint/actions/workflows/testing.yml).
2. Create a pull request to prepare the release.
    1. Determine a new version, such as "1.0.0".
    2. Update `CHANGELOG.md` to add the new version and notable changes since the last version.
    3. Run `NEW_VERSION=<new_version> npm run prepare-release` to commit the changes, including `package.json`.
    4. Push a new commit.
    5. Create a pull request.
3. Merge the pull request if it's approved.
4. Wait until the latest CI is completed.
5. Run the releasing workflow on [GitHub Actions](https://github.com/stylelint/vscode-stylelint/actions/workflows/releasing.yml) if the CI succeeds.
6. Confirm that the new version is available on [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint).
7. Adjust the release notes on [GitHub Releases](https://github.com/stylelint/vscode-stylelint/releases).
