# Stylelint Runtime Services

This folder hosts the services that locate, configure, and run Stylelint:

- discovery helpers (`package-root`, `global-path-resolver`, `process-runner`).
- orchestration (`workspace-stylelint`, `worker-process`).
- request level helpers (`stylelint-options`, `stylelint-runner`).

`stylelintRuntimeModule` registers every class here and imports the workspace module so runtime execution automatically inherits workspace awareness.
