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
gigadrive vm create --image node22 --port 3000 --timeout 30m   # prints the ID and preview URLs
gigadrive vm exec <id> -- npm install                           # streams output, exits with its code
gigadrive vm exec <id> -- 'ls -la | wc -l'                      # one quoted argument runs through /bin/sh -c
gigadrive vm cp ./app vm:<id>:/app                              # copy in (directories are recursive)
gigadrive vm cp vm:<id>:/app/dist ./dist                        # and out
gigadrive vm shell <id>                                         # interactive terminal
gigadrive vm ls                                                 # running microVMs (--all includes stopped)
gigadrive vm extend <id> 1h                                     # stop it one hour from now
gigadrive vm stop <id> && gigadrive vm rm <id>
gigadrive vm images create py-ml --from python:3.13 --wait      # custom images (or --dockerfile ./Dockerfile)
```

`create` takes `--vcpus`, `--memory` and `--disk` (MiB), `--env KEY=VALUE`,
`--metadata KEY=VALUE`, `--deny-egress` and `--app` (defaults to the linked
application). `exec` takes `--cwd`, `--env`, `--user`, `--sudo`, `--timeout`
and `-i` to forward stdin.
