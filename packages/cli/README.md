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
