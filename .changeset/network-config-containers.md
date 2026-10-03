---
'@gigadrive/network-config': minor
'gigadrive': minor
---

`gigadrive.yaml` now accepts a top-level `containers` map for running Docker images on Gigadrive Network.

Each entry runs one image, from a registry (`image: redis:7-alpine`) or built from a Dockerfile in the repository (`build: .`, or `build: { context, dockerfile, target, args }`). Optional settings are `port`, `entrypoint`, `command`, `env`, `working_dir`, `user` and `memory`.

- A container without `sidecar: true` runs as a function. Routes target it with `destination: container:<name>`. It also takes `max_duration`, `streaming` and `schedule`. A project that is nothing but one container function gets a catch-all route.
- A container with `sidecar: true` runs next to every function instance, inside the same microVM, and answers at `<name>:<port>`. That makes it the place for an adjacent Redis or a search engine. A deployment may declare at most four sidecars, and a sidecar may not use a port the function's runtime binds.

A new top-level `compose` key imports the services of a Compose file as containers. The service marked `x-gigadrive: { public: true }` becomes the function, or else the only service that builds from source; when that is ambiguous, the config is rejected until one is marked. Every other service becomes a sidecar. Entries under `containers` win over imported services of the same name.

`detectContainerProject()` recognizes a project with a Compose file that declares an app, or failing that a root `Dockerfile`, and returns a deployable configuration. The CLI tries it only when a project has neither a `gigadrive.yaml` nor a detected framework, so a framework project that keeps a Compose file for local databases deploys exactly as before. The CLI also keeps `Dockerfile`, `Dockerfile.*`, `*.Dockerfile` and Compose files in the upload, and leaves `.dockerignore` to the image build when a deployment builds images, which matches what `docker build` sends.

Exported additions:

- `NormalizedConfig.sidecars`
- `NormalizedConfigEntrypoint.container`
- `NormalizedContainerSpec`, `NormalizedSidecar` and `NormalizedContainerImageSource`
- `CONTAINER_RUNTIME`, `CONTAINER_ENTRYPOINT_PREFIX` and related constants
- `ContainerConfigError`
- `normalizeContainers`, `readComposeContainers`, `splitCommandWords` and `containerEntrypointPath`
- `detectContainerProject`

**Type change:** `NormalizedConfigEntrypoint.runtime` is now `Runtime | 'docker'`. Configs that declare no containers produce exactly the same output as before. Code that passes an entrypoint's runtime into a function typed `Runtime` must first handle the `docker` case. Such an entrypoint carries a `container` spec instead of a file path.
