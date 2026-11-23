# Gigadrive CLI

Deploy a supported framework from its project directory without a Gigadrive
configuration file:

```bash
pnpm dlx gigadrive login
pnpm dlx gigadrive deploy
```

For an unlinked project, `deploy` selects the authenticated user's organization,
creates a Network application, saves the local `.gigadrive/project.json` link,
auto-detects the framework, and deploys it. Use `--org` when the user belongs to
multiple organizations and a non-interactive deployment must select one.

Applications can also be created independently:

```bash
pnpm dlx gigadrive apps create --org <organization-id> --name <application-name>
```

The legacy `gigadrive platform deploy` command remains available as an alias for
`gigadrive deploy`.

## microVMs

microVMs are isolated Linux machines for running code. `gigadrive vm` is an
alias of `gigadrive microvms`.

```bash
gigadrive vm create --image node22 --port 3000 --timeout 30m   # waits until it runs, prints the ID and preview URLs
gigadrive vm exec <id> -- npm install                           # streams output, exits with its code
gigadrive vm exec <id> -- 'ls -la | wc -l'                      # one quoted argument runs through /bin/sh -c
gigadrive vm cp ./app vm:<id>:/app                              # copy in (directories are recursive, 8 files at a time)
gigadrive vm cp vm:<id>:/app/dist ./dist                        # and out
gigadrive vm shell <id>                                         # interactive terminal
gigadrive vm ls                                                 # running microVMs (--all includes stopped)
gigadrive vm extend <id> 1h                                     # stop it one hour from now
gigadrive vm network <id> --deny-egress                         # cut its internet while it runs
gigadrive vm pause <id> && gigadrive vm resume <id>             # keep memory and processes, stop paying for CPU
gigadrive vm snapshot <id> --name after-install                 # capture it; it keeps running
gigadrive vm snapshots ls                                       # and `snapshots get|rm <snapshot-id>`
gigadrive vm fork <snapshot-id> --port 3000                     # a new microVM from the snapshot
gigadrive vm stop <id> && gigadrive vm rm <id>
gigadrive vm images create py-ml --from python:3.13 --wait      # custom images (or --dockerfile ./Dockerfile)
```

`create` takes `--vcpus`, `--memory` and `--disk` (MiB), `--env KEY=VALUE`,
`--metadata KEY=VALUE`, `--deny-egress` and `--app` (defaults to the linked
application). `create` and `fork` wait until the microVM runs, up to
`--wait-timeout` (default 8m), with a progress line on stderr, and fail if it
fails to start; `--no-wait` returns as soon as the API answers. `pause`,
`resume` and `snapshot` wait the same way, and every one of them takes `--json`.
`exec` takes `--cwd`, `--env`, `--user`, `--sudo`, `--timeout` and `-i` to
forward stdin. `cp` takes `--concurrency` (default 8) and retries a file after
a server or network error.

Errors print one line with what to do next; pass `--log-level debug` (before or
after the subcommand) for details and stack traces.
