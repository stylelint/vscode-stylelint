# Infrastructure Services

Infrastructure services wrap shared platform concerns such as registering LSP commands, fan-out notification handling, and logging abstractions. These pieces are imported very early by `infrastructureModule`, making them available to every other module without creating circular dependencies.
