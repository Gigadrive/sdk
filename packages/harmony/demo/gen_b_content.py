#!/usr/bin/env python3
exec(open('gen_b_pages.py').read())

pages = {}

# ═════════ 1. Org dashboard (console home) ═════════
def app_row(name, host, status_color, commit, time, repo):
    return f'''<a class="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
      <div class="relative"><div class="size-8 rounded-lg bg-gradient-to-br from-zinc-500/40 to-zinc-700/40 border border-border grid place-items-center text-xs font-semibold">{name[0].upper()}</div>
        <span class="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-card {'bg-muted-foreground/50' if status_color == 'muted' else ''}" style="{'' if status_color == 'muted' else f'background:hsl(var(--{status_color}))'}"></span></div>
      <div class="w-52 min-w-0 flex-shrink-0"><div class="text-sm font-medium truncate">{name}</div><div class="text-xs text-muted-foreground truncate">{host}</div></div>
      <div class="hidden min-w-0 flex-1 md:block"><div class="text-xs text-muted-foreground truncate">{commit}</div><div class="text-[11px] text-muted-foreground/70 mt-0.5">{time}</div></div>
      <div class="hidden max-w-44 flex-shrink lg:block"><span class="raised flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">{icon('github', 'size-3')}<span class="truncate">{repo}</span></span></div>
      <span class="opacity-0 group-hover:opacity-100 text-muted-foreground">{icon('dots')}</span>
    </a>'''

org_content = f'''
      <div class="flex items-center gap-2 px-4 py-3">
        <div class="relative flex-1 max-w-xs">
          {icon('search', 'size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground')}
          <input class="well flex h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground" placeholder="Search Projects..." />
        </div>
        <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">Sort: Activity {icon('chevrons', 'size-3 text-muted-foreground')}</button>
        <div class="well inline-flex h-8 items-center rounded-lg bg-muted p-0.5">
          <button class="raised rounded-md px-2 py-0.5 text-xs font-medium bg-card">List</button>
          <button class="rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground">Grid</button>
        </div>
        <div class="flex flex-1 justify-end">
          <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_PRIMARY}">{icon('plus', 'size-3.5')}New Project</button>
        </div>
      </div>
      <div class="flex gap-4 px-4 pb-4 flex-1 min-h-0">
        <div class="min-w-0 flex-1">
          <div class="card-tactile divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {app_row('gigadrive-api', 'api.gigadrive.network', 'success', 'fix: cache invalidation on env promote', '2 minutes ago via GitHub', 'Gigadrive/network')}
            {app_row('console', 'console.gigadrive.de', 'success', 'feat: request tracing flyout', '1 hour ago via GitHub', 'Gigadrive/network')}
            {app_row('idp', 'idp.gigadrive.de', 'success', 'chore: bump elysia', '3 hours ago via GitHub', 'Gigadrive/network')}
            {app_row('mcskinhistory', 'mcskinhistory.com', 'warning', 'feat: skin render pipeline v2', 'Building — 40 s', 'Gigadrive/mcskinhistory')}
            {app_row('marketing-site', 'gigadrive.de', 'success', 'content: pricing update DE', 'yesterday via GitHub', 'Gigadrive/network')}
            {app_row('legacy-worker', 'worker.gigadrive.network', 'muted', 'chore: archive', '3 weeks ago', 'Gigadrive/legacy')}
          </div>
        </div>
        <aside class="hidden w-72 flex-shrink-0 xl:flex flex-col gap-4">
          <div class="card-tactile rounded-xl border bg-card p-4">
            <div class="flex items-center justify-between"><h3 class="text-sm font-semibold">Usage</h3><span class="text-[11px] text-muted-foreground">resets in 9 d</span></div>
            <div class="mt-3 space-y-3">
              <div><div class="flex justify-between text-xs"><span class="text-muted-foreground">Compute</span><span class="tabular-nums">412.6 / 1,000 h</span></div>
                <div class="well mt-1.5 h-2 w-full rounded-full bg-muted"><div class="fill-gloss h-2 rounded-full" style="width:41%"></div></div></div>
              <div><div class="flex justify-between text-xs"><span class="text-muted-foreground">Bandwidth</span><span class="tabular-nums">1.9 / 5 TB</span></div>
                <div class="well mt-1.5 h-2 w-full rounded-full bg-muted"><div class="fill-gloss h-2 rounded-full" style="width:38%"></div></div></div>
              <div><div class="flex justify-between text-xs"><span class="text-muted-foreground">Storage</span><span class="tabular-nums">86.2 / 100 GB</span></div>
                <div class="well mt-1.5 h-2 w-full rounded-full bg-muted"><div class="fill-gloss h-2 rounded-full" style="width:86%; background-color: hsl(var(--warning-fill)); background-image:linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.05) 55%, transparent)"></div></div></div>
            </div>
          </div>
          <div class="card-tactile rounded-xl border bg-card p-4">
            <h3 class="text-sm font-semibold">Recent deployments</h3>
            <div class="mt-2 -mx-1">
              <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40"><span class="size-1.5 rounded-full" style="background:hsl(var(--success)); box-shadow:0 0 5px hsl(var(--success)/0.6)"></span><span class="text-xs font-medium">gigadrive-api</span><span class="text-[11px] text-muted-foreground ml-auto">2 m</span></div>
              <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40"><span class="size-1.5 rounded-full animate-pulse" style="background: hsl(var(--warning-fill))"></span><span class="text-xs font-medium">mcskinhistory</span><span class="text-[11px] text-muted-foreground ml-auto">8 m</span></div>
              <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40"><span class="size-1.5 rounded-full" style="background:hsl(var(--danger))"></span><span class="text-xs font-medium">console</span><span class="text-[11px] text-muted-foreground ml-auto">26 m</span></div>
              <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40"><span class="size-1.5 rounded-full" style="background:hsl(var(--success))"></span><span class="text-xs font-medium">idp</span><span class="text-[11px] text-muted-foreground ml-auto">3 h</span></div>
            </div>
          </div>
        </aside>
      </div>'''
pages['b-org'] = console_page([crumb_btn('Gigadrive GmbH')], SIDE_ORG('overview'), org_content)

# ═════════ 2. Environment overview ═════════
AREA = '''<svg class="w-full h-28" viewBox="0 0 600 110" preserveAspectRatio="none" fill="none">
  <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="hsl(142 65% 46%)" stop-opacity="0.25"/><stop offset="100%" stop-color="hsl(142 65% 46%)" stop-opacity="0"/></linearGradient></defs>
  <path d="M0 80 L30 78 L60 82 L90 70 L120 74 L150 62 L180 66 L210 52 L240 58 L270 44 L300 50 L330 38 L360 46 L390 30 L420 40 L450 26 L480 34 L510 20 L540 28 L570 16 L600 22 V110 H0 Z" fill="url(#tg)"/>
  <path d="M0 80 L30 78 L60 82 L90 70 L120 74 L150 62 L180 66 L210 52 L240 58 L270 44 L300 50 L330 38 L360 46 L390 30 L420 40 L450 26 L480 34 L510 20 L540 28 L570 16 L600 22" stroke="hsl(142 65% 46%)" stroke-width="1.5"/>
</svg>'''

env_content = f'''
      <div class="px-4 py-3 space-y-4">
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
          <div class="flex min-w-0 flex-col gap-4">
            <div class="card-tactile rounded-xl border bg-card p-4">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="size-9 rounded-lg grid place-items-center bg-success-soft" >{icon('checkcircle', 'size-4 text-success')}</div>
                  <div>
                    <div class="flex items-center gap-2"><span class="text-sm font-semibold">Active deployment</span>{chip('Ready', 'success', glow=True)}</div>
                    <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-2"><span class="font-mono text-[12px]">dpl_8f2ac91b</span><span>·</span>{icon('branch', 'size-3')}<span>main</span><span>·</span><span>fix: cache invalidation on env promote</span></div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">Redeploy</button>
                  <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_PRIMARY}">Visit {icon('globe', 'size-3.5')}</button>
                </div>
              </div>
              <div class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">{icon('globe', 'size-3.5')}<a class="text-primary hover:underline">api.gigadrive.network</a><span>·</span><span>deployed 2 minutes ago</span><span>·</span><span class="tabular-nums">build 42 s</span></div>
            </div>
            <div class="card-tactile rounded-xl border bg-card p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">Traffic</h3>
                <div class="well inline-flex h-7 items-center rounded-lg bg-muted p-0.5">
                  <button class="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground">1 h</button>
                  <button class="raised rounded-md px-2 py-0.5 text-[11px] font-medium bg-card">24 h</button>
                  <button class="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground">7 d</button>
                </div>
              </div>
              <div class="mt-2 flex items-baseline gap-4">
                <div><span class="text-xl font-semibold tabular-nums tracking-tight">1.24 M</span> <span class="text-[11px] text-muted-foreground">requests</span></div>
                <div><span class="text-xl font-semibold tabular-nums tracking-tight">184 ms</span> <span class="text-[11px] text-muted-foreground">p95</span></div>
                <div><span class="text-xl font-semibold tabular-nums tracking-tight text-success">0.02%</span> <span class="text-[11px] text-muted-foreground">errors</span></div>
              </div>
              <div class="mt-2">{AREA}</div>
              <div class="flex justify-between text-[10px] text-muted-foreground/70 mt-1 px-0.5"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span></div>
            </div>
            <div class="card-tactile rounded-xl border bg-card overflow-hidden">
              <div class="flex items-center justify-between p-4 pb-2"><h3 class="text-sm font-semibold">Recent deployments</h3><button class="text-xs text-primary hover:underline">View all</button></div>
              <div class="divide-y divide-border/70">
                <div class="flex items-center gap-3 px-4 py-2 hover:bg-muted/40"><span class="font-mono text-[12px] w-28">dpl_8f2ac91b</span>{chip('Ready', 'success', glow=True)}<span class="text-xs text-muted-foreground flex-1 truncate">fix: cache invalidation on env promote</span><span class="text-[11px] text-muted-foreground">2 m</span></div>
                <div class="flex items-center gap-3 px-4 py-2 hover:bg-muted/40"><span class="font-mono text-[12px] w-28">dpl_c3d94a02</span>{chip('Failed', 'danger', soft=True)}<span class="text-xs text-muted-foreground flex-1 truncate">wip: cache adapter</span><span class="text-[11px] text-muted-foreground">26 m</span></div>
                <div class="flex items-center gap-3 px-4 py-2 hover:bg-muted/40"><span class="font-mono text-[12px] w-28">dpl_5b8e2d11</span>{chip('Ready', 'success')}<span class="text-xs text-muted-foreground flex-1 truncate">feat: request tracing</span><span class="text-[11px] text-muted-foreground">3 h</span></div>
              </div>
            </div>
          </div>
          <div class="flex min-w-0 flex-col gap-4">
            <div class="card-tactile rounded-xl border bg-card p-4">
              <h3 class="text-sm font-semibold">Environment</h3>
              <dl class="mt-3 space-y-2.5 text-xs">
                <div class="flex justify-between"><dt class="text-muted-foreground">Name</dt><dd class="flex items-center gap-1.5"><span class="size-1.5 rounded-full" style="background:hsl(var(--success))"></span>Production</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Region</dt><dd>eu-central (Frankfurt)</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Runtime</dt><dd>Node.js 22</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Always-warm</dt><dd class="text-success font-medium">Enabled</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Domain</dt><dd class="text-primary">api.gigadrive.network</dd></div>
              </dl>
            </div>
            <div class="card-tactile rounded-xl border bg-card p-4">
              <h3 class="text-sm font-semibold">Resources</h3>
              <div class="mt-3 space-y-3">
                <div><div class="flex justify-between text-xs"><span class="text-muted-foreground">CPU</span><span class="tabular-nums">23%</span></div>
                  <div class="well mt-1.5 h-2 w-full rounded-full bg-muted"><div class="fill-gloss h-2 rounded-full" style="width:23%"></div></div></div>
                <div><div class="flex justify-between text-xs"><span class="text-muted-foreground">Memory</span><span class="tabular-nums">612 MB / 1 GB</span></div>
                  <div class="well mt-1.5 h-2 w-full rounded-full bg-muted"><div class="fill-gloss h-2 rounded-full" style="width:61%"></div></div></div>
                <div><div class="flex justify-between text-xs"><span class="text-muted-foreground">Instances</span><span class="tabular-nums">2 warm</span></div>
                  <div class="mt-1.5 flex gap-1"><span class="raised h-2 flex-1 rounded-full" style="background:hsl(var(--success)/0.65)"></span><span class="raised h-2 flex-1 rounded-full" style="background:hsl(var(--success)/0.65)"></span><span class="h-2 flex-1 rounded-full bg-muted"></span><span class="h-2 flex-1 rounded-full bg-muted"></span></div></div>
              </div>
            </div>
            <div class="card-tactile rounded-xl border bg-card p-4">
              <div class="flex items-center justify-between"><h3 class="text-sm font-semibold">Branches</h3><button class="text-xs text-primary hover:underline">Manage</button></div>
              <div class="mt-2 space-y-1 text-xs">
                <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40">{icon('branch', 'size-3.5 text-muted-foreground')}<span class="font-medium">main</span><span class="rounded-full border border-border px-1.5 text-[10px] text-muted-foreground">auto-deploy</span></div>
                <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40">{icon('branch', 'size-3.5 text-muted-foreground')}<span>feat/edge-cache</span><span class="text-[10px] text-muted-foreground ml-auto">preview</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>'''
pages['b-env'] = console_page([crumb_btn('Gigadrive GmbH'), crumb_btn('gigadrive-api'), crumb_btn('Production', dot=True, bold=False)], SIDE_APP('overview'), env_content)

# ═════════ 3. Deployment detail — build logs ═════════
def log_line(t, msg, level=None, cls=''):
    lv = ''
    if level == 'info': lv = '<span class="raised rounded border border-border bg-card px-1 text-[9px] font-semibold text-info">INFO</span>'
    if level == 'warn': lv = '<span class="raised rounded border border-border bg-card px-1 text-[9px] font-semibold text-warning">WARN</span>'
    if level == 'ok': lv = '<span class="raised rounded border border-border bg-card px-1 text-[9px] font-semibold text-success">DONE</span>'
    return f'<div class="flex items-baseline gap-3 px-4 py-0.5 hover:bg-white/[0.03]"><span class="text-[11px] text-muted-foreground/60 tabular-nums shrink-0 w-20">{t}</span>{lv}<span class="text-[12px] {cls}">{msg}</span></div>'

dep_content = f'''
      <div class="shrink-0 border-b bg-card/50">
        <div class="px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="size-9 rounded-lg grid place-items-center bg-success-soft">{icon('checkcircle', 'size-4 text-success')}</div>
            <div>
              <div class="flex items-center gap-2"><h1 class="text-base font-semibold tracking-tight text-success">Ready</h1>{chip('Production', 'success')}</div>
              <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5"><span class="font-mono text-[12px]">dpl_8f2ac91b</span><span>·</span>{icon('branch', 'size-3')}main<span>·</span>fix: cache invalidation on env promote<span>·</span><span class="tabular-nums">42 s</span></div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">Rollback</button>
            <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_PRIMARY}">Visit {icon('globe', 'size-3.5')}</button>
          </div>
        </div>
        <div class="px-4 pb-2">
          <div class="well inline-flex h-8 items-center rounded-lg bg-muted p-0.5">
            <button class="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground">Overview</button>
            <button class="raised rounded-md px-2.5 py-1 text-xs font-medium bg-card flex items-center gap-1.5">Build Logs<span class="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums">214</span></button>
            <button class="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground">Runtime Logs</button>
            <button class="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">Requests<span class="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums">1.2k</span></button>
            <button class="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground">Checks</button>
          </div>
        </div>
      </div>
      <div class="p-4 flex-1 min-h-0 flex flex-col">
        <div class="well rounded-xl border border-border bg-[hsl(170_10%_4%)] font-mono flex-1 min-h-0 overflow-hidden flex flex-col">
          <div class="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <div class="flex items-center gap-2 text-[11px] text-muted-foreground">{icon('terminal', 'size-3.5')}<span>Build — Node.js 22 · eu-central</span></div>
            <div class="flex items-center gap-2">
              <div class="relative">{icon('search', 'size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60')}<input class="h-6 w-44 rounded-md border border-white/10 bg-white/[0.04] pl-6 pr-2 text-[11px] placeholder:text-muted-foreground/50" placeholder="Filter logs…" /></div>
              <button class="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">{icon('download', 'size-3')}Raw</button>
            </div>
          </div>
          <div class="py-2 overflow-auto text-foreground/90">
            {log_line('14:02:11.204', 'Cloning github.com/Gigadrive/network (branch: main, commit: 8e4af6a)')}
            {log_line('14:02:12.891', 'Cloned in 1.69 s')}
            {log_line('14:02:13.002', 'Restoring build cache — 214 MB', 'info')}
            {log_line('14:02:14.310', 'Running "pnpm install --frozen-lockfile"')}
            {log_line('14:02:21.577', 'Packages: +1,204 · reused 1,198 from store')}
            {log_line('14:02:21.610', 'Done in 7.2 s')}
            {log_line('14:02:21.688', 'Running "pnpm build" (turbo run build --filter=api...)')}
            {log_line('14:02:24.115', '@gigadrive/commons:build — cache hit, replaying output')}
            {log_line('14:02:24.303', '@gigadrive/network-config:build — cache hit, replaying output')}
            {log_line('14:02:29.441', 'api:build — tsup src/index.ts — ESM ⚡️ 412 KB in 4.9 s')}
            {log_line('14:02:30.008', 'Deprecated dependency detected: node-fetch@2 — consider native fetch', 'warn', 'text-warning')}
            {log_line('14:02:33.120', 'Creating deployment image (linux/arm64)…')}
            {log_line('14:02:41.881', 'Image pushed — 96 MB (compressed)')}
            {log_line('14:02:47.109', 'Provisioning 2 warm instances in eu-central…')}
            {log_line('14:02:52.660', 'Health check passed on /healthz (200, 11 ms)')}
            {log_line('14:02:53.201', 'Deployment ready — https://api.gigadrive.network', 'ok', 'text-success font-medium')}
          </div>
        </div>
      </div>'''
pages['b-deployment'] = console_page([crumb_btn('Gigadrive GmbH'), crumb_btn('gigadrive-api'), crumb_btn('Production', dot=True, bold=False)], SIDE_APP('deployments'), dep_content)

# ═════════ 4. Environment variables ═════════
def var_row(key, scope_prod, scope_prev, updated):
    scopes = ''
    if scope_prod: scopes += chip('Production', 'success')
    if scope_prev: scopes += ' ' + '<span class="raised inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">Preview</span>'
    return f'''<div class="grid grid-cols-[220px_1fr_auto_90px_auto] items-center gap-4 px-5 py-2.5 hover:bg-muted/40">
      <span class="font-mono text-[12px] font-medium truncate">{key}</span>
      <span class="flex items-center gap-2 min-w-0"><span class="font-mono text-[12px] text-muted-foreground tracking-wider">••••••••••••</span><button class="text-muted-foreground hover:text-foreground">{icon('eye', 'size-3.5')}</button></span>
      <span class="flex gap-1.5">{scopes}</span>
      <span class="text-[11px] text-muted-foreground text-right">{updated}</span>
      <span class="text-muted-foreground">{icon('dots')}</span>
    </div>'''

vars_content = f'''
      <div class="px-4 py-3 space-y-4 max-w-4xl">
        <div class="card-tactile rounded-xl border bg-card overflow-hidden">
          <div class="p-5 pb-3">
            <h3 class="text-sm font-semibold leading-none tracking-tight">Add environment variable</h3>
            <div class="text-xs text-muted-foreground mt-1">Available to your application at build- and runtime. Values are encrypted at rest.</div>
          </div>
          <div class="px-5 pb-4 flex items-end gap-2">
            <div class="w-56"><label class="block text-xs font-medium mb-1.5">Key</label><input placeholder="DATABASE_URL" class="well flex h-8 w-full rounded-lg border border-input bg-background px-2.5 font-mono" style="font-size:12px" /></div>
            <div class="flex-1"><label class="block text-xs font-medium mb-1.5">Value</label><input placeholder="postgres://…" class="well flex h-8 w-full rounded-lg border border-input bg-background px-2.5 font-mono" style="font-size:12px" /></div>
            <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">Production {icon('chevrons', 'size-3 text-muted-foreground')}</button>
            <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_PRIMARY}">{icon('plus', 'size-3.5')}Add</button>
          </div>
        </div>
        <div class="card-tactile rounded-xl border bg-card overflow-hidden">
          <div class="flex items-center justify-between p-5 pb-3">
            <div><h3 class="text-sm font-semibold leading-none tracking-tight">Environment variables</h3><div class="text-xs text-muted-foreground mt-1">8 variables · last change 2 days ago</div></div>
            <div class="relative">{icon('search', 'size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground')}<input class="well flex h-8 w-52 rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground" placeholder="Search…" /></div>
          </div>
          <div class="border-t divide-y divide-border/70">
            {var_row('DATABASE_URL', True, True, '2 d ago')}
            {var_row('REDIS_URL', True, True, '2 d ago')}
            {var_row('STRIPE_SECRET_KEY', True, False, '9 d ago')}
            {var_row('STRIPE_WEBHOOK_SECRET', True, False, '9 d ago')}
            {var_row('GITHUB_APP_PRIVATE_KEY', True, True, '3 w ago')}
            {var_row('POSTHOG_API_KEY', True, True, '1 mo ago')}
            {var_row('SMTP_PASSWORD', True, False, '2 mo ago')}
            {var_row('SENTRY_DSN', True, True, '2 mo ago')}
          </div>
          <div class="flex items-center justify-between border-t bg-muted/40 px-5 py-2.5">
            <span class="text-xs text-muted-foreground">Changes apply on the next deployment.</span>
            <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">{icon('download', 'size-3.5')}Export .env</button>
          </div>
        </div>
      </div>'''
pages['b-variables'] = console_page([crumb_btn('Gigadrive GmbH'), crumb_btn('gigadrive-api'), crumb_btn('Production', dot=True, bold=False)], SIDE_APP('settings'), vars_content)

# ═════════ 5. Billing ═════════
def invoice_row(no, date, amount, status, color):
    return f'''<tr class="border-b hover:bg-muted/40 last:border-0">
      <td class="px-5 py-2.5 font-mono text-[12px]">{no}</td>
      <td class="px-4 py-2.5 text-muted-foreground">{date}</td>
      <td class="px-4 py-2.5 tabular-nums">{amount}</td>
      <td class="px-4 py-2.5">{chip(status, color, soft=(color=='danger'))}</td>
      <td class="px-4 py-2.5 text-right"><button class="text-muted-foreground hover:text-foreground">{icon('download', 'size-4')}</button></td>
    </tr>'''

billing_content = f'''
      <div class="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">Plan, payment method, budget, and invoices</p>
        <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-7 px-2.5 {GLOSS_OUTLINE}">Billing portal</button>
      </div>
      <div class="px-4 py-4 space-y-4 max-w-4xl">
        <div class="grid grid-cols-3 gap-4">
          <div class="card-tactile rounded-xl border bg-card p-4">
            <div class="flex items-center justify-between"><span class="text-xs text-muted-foreground">Current plan</span><span class="raised inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.15),transparent_60%)]">PRO</span></div>
            <div class="mt-2 text-2xl font-semibold tabular-nums tracking-tight">€49<span class="text-sm font-normal text-muted-foreground">/mo</span></div>
            <div class="text-xs text-muted-foreground mt-1">Renews Sep 1, 2026</div>
            <button class="mt-3 w-full inline-flex items-center justify-center rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">Change plan</button>
          </div>
          <div class="card-tactile rounded-xl border bg-card p-4">
            <div class="text-xs text-muted-foreground">Usage this period</div>
            <div class="mt-2 text-2xl font-semibold tabular-nums tracking-tight">€63.20</div>
            <div class="well mt-2.5 h-2 w-full rounded-full bg-muted"><div class="fill-gloss h-2 rounded-full" style="width:63%"></div></div>
            <div class="flex justify-between text-[11px] text-muted-foreground mt-1.5"><span>Budget alert at €80</span><span class="tabular-nums">€100 cap</span></div>
          </div>
          <div class="card-tactile rounded-xl border bg-card p-4">
            <div class="text-xs text-muted-foreground">Payment method</div>
            <div class="mt-2 flex items-center gap-3">
              <div class="raised h-9 w-14 rounded-md border border-border bg-card grid place-items-center text-[10px] font-bold tracking-wide">VISA</div>
              <div><div class="text-sm font-medium">•••• 4242</div><div class="text-[11px] text-muted-foreground">Expires 04/28</div></div>
            </div>
            <button class="mt-3 w-full inline-flex items-center justify-center rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">Update</button>
          </div>
        </div>
        <div class="card-tactile rounded-xl border bg-card overflow-hidden">
          <div class="p-5 pb-3"><h3 class="text-sm font-semibold leading-none tracking-tight">Invoices</h3></div>
          <table class="w-full text-sm">
            <thead><tr class="border-b border-t bg-muted/30">
              <th class="h-8 px-5 text-left align-middle text-[11px] font-medium text-muted-foreground">Invoice</th>
              <th class="h-8 px-4 text-left align-middle text-[11px] font-medium text-muted-foreground">Date</th>
              <th class="h-8 px-4 text-left align-middle text-[11px] font-medium text-muted-foreground">Amount</th>
              <th class="h-8 px-4 text-left align-middle text-[11px] font-medium text-muted-foreground">Status</th>
              <th class="h-8 px-4 w-10"></th>
            </tr></thead>
            <tbody>
              {invoice_row('INV-2026-0081', 'Aug 1, 2026', '€112.40', 'Paid', 'success')}
              {invoice_row('INV-2026-0074', 'Jul 1, 2026', '€98.10', 'Paid', 'success')}
              {invoice_row('INV-2026-0068', 'Jun 1, 2026', '€103.55', 'Paid', 'success')}
              {invoice_row('INV-2026-0061', 'May 1, 2026', '€87.00', 'Refunded', 'muted')}
              {invoice_row('INV-2026-0055', 'Apr 1, 2026', '€91.75', 'Paid', 'success')}
            </tbody>
          </table>
        </div>
      </div>'''
pages['b-billing'] = console_page([crumb_btn('Gigadrive GmbH')], SIDE_ORG('billing'), billing_content)

# ═════════ 6. Storage objects ═════════
def obj_row(ic, name, size, ctype, modified):
    return f'''<tr class="border-b hover:bg-muted/40 last:border-0">
      <td class="pl-4 pr-2 py-2 w-8"><div class="well size-4 rounded border border-input bg-background"></div></td>
      <td class="px-2 py-2"><span class="flex items-center gap-2.5">{icon(ic, 'size-4 text-muted-foreground')}<span class="text-[13px] font-medium">{name}</span></span></td>
      <td class="px-4 py-2 tabular-nums text-muted-foreground text-[13px]">{size}</td>
      <td class="px-4 py-2 text-muted-foreground text-[13px] font-mono" style="font-size:11px">{ctype}</td>
      <td class="px-4 py-2 text-muted-foreground text-[13px]">{modified}</td>
      <td class="px-4 py-2 text-right"><span class="text-muted-foreground">{icon('dots')}</span></td>
    </tr>'''

storage_content = f'''
      <div class="flex items-center gap-2 px-4 py-3 border-b">
        <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">{icon('box', 'size-3.5')}uploads {icon('chevrons', 'size-3 text-muted-foreground')}</button>
        <div class="flex items-center gap-1 text-[13px] text-muted-foreground"><span class="hover:text-foreground cursor-pointer">uploads</span><span>/</span><span class="hover:text-foreground cursor-pointer">avatars</span><span>/</span><span class="text-foreground font-medium">2026</span></div>
        <div class="flex flex-1 justify-end gap-2">
          <div class="relative">{icon('search', 'size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground')}<input class="well flex h-8 w-56 rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground" placeholder="Search objects…" /></div>
          <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE}">{icon('folder', 'size-3.5')}New folder</button>
          <button class="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_PRIMARY}">{icon('upload', 'size-3.5')}Upload</button>
        </div>
      </div>
      <table class="w-full text-sm">
        <thead><tr class="border-b bg-muted/30">
          <th class="h-8 pl-4 pr-2 w-8"></th>
          <th class="h-8 px-2 text-left align-middle text-[11px] font-medium text-muted-foreground">Name</th>
          <th class="h-8 px-4 text-left align-middle text-[11px] font-medium text-muted-foreground">Size</th>
          <th class="h-8 px-4 text-left align-middle text-[11px] font-medium text-muted-foreground">Content type</th>
          <th class="h-8 px-4 text-left align-middle text-[11px] font-medium text-muted-foreground">Last modified</th>
          <th class="h-8 px-4 w-10"></th>
        </tr></thead>
        <tbody>
          {obj_row('folder', '08', '—', '—', 'Aug 21, 2026')}
          {obj_row('folder', '07', '—', '—', 'Jul 30, 2026')}
          {obj_row('image', 'u_4821_avatar.webp', '48.2 KB', 'image/webp', '2 hours ago')}
          {obj_row('image', 'u_4820_avatar.webp', '51.7 KB', 'image/webp', '4 hours ago')}
          {obj_row('image', 'u_4817_avatar.webp', '44.9 KB', 'image/webp', 'yesterday')}
          {obj_row('file', 'export-2026-08.csv', '1.2 MB', 'text/csv', 'Aug 18, 2026')}
          {obj_row('image', 'u_4812_avatar.webp', '39.1 KB', 'image/webp', 'Aug 16, 2026')}
          {obj_row('file', 'banner_fall.png', '412 KB', 'image/png', 'Aug 12, 2026')}
        </tbody>
      </table>
      <div class="mt-auto flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground border-t">
        <span>8 items · 2.1 MB selected of 86.2 GB used</span>
        <span class="tabular-nums">uploads · eu-central</span>
      </div>'''
pages['b-storage'] = console_page([crumb_btn('Gigadrive GmbH'), crumb_btn('gigadrive-api'), crumb_btn('Production', dot=True, bold=False)], SIDE_APP('storage'), storage_content)

# ═════════ 7. Sign-in (my.gigadrive.de auth shell) ═════════
pages['b-signin'] = f'''{HEAD}
<body class="pb font-sans antialiased text-foreground">
<div class="relative min-h-screen w-screen overflow-hidden flex items-center justify-center p-6"
     style="background: radial-gradient(1200px 700px at 75% -10%, hsl(150 45% 18%), transparent 60%), radial-gradient(900px 600px at -10% 110%, hsl(160 40% 12%), transparent 55%), linear-gradient(160deg, hsl(170 12% 7%), hsl(168 10% 4%) 70%)">
  <div class="pointer-events-none absolute inset-0" style="background-image: radial-gradient(rgba(74,222,128,0.14) 1px, transparent 1.5px); background-size: 22px 22px; mask-image: linear-gradient(to bottom, black, transparent 70%)"></div>
  <div class="pointer-events-none absolute inset-0 bg-black/25"></div>
  <div class="dark relative z-10 w-full max-w-[450px]">
    <div class="card-tactile overflow-hidden rounded-2xl border border-border/80 bg-card p-8" style="box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.5), 0 24px 60px -12px rgba(0,0,0,0.7)">
      <div class="flex flex-col items-center text-center">
        <div class="raised size-11 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold text-lg bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.18),transparent_60%)]">G</div>
        <h1 class="mt-4 text-xl font-semibold tracking-tight">Sign in to Gigadrive</h1>
        <p class="mt-1 text-sm text-muted-foreground">One account for all Gigadrive services.</p>
      </div>
      <div class="mt-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1.5">Email</label>
          <input type="email" value="you@example.com" class="well flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1.5"><label class="text-sm font-medium">Password</label><a class="text-xs text-primary hover:underline">Forgot password?</a></div>
          <div class="relative">
            <input type="password" value="••••••••••••" class="well flex h-10 w-full rounded-lg border border-input bg-background px-3 pr-9 text-sm" />
            <button class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{icon('eye', 'size-4')}</button>
          </div>
        </div>
        <button class="w-full inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 {GLOSS_PRIMARY}">Sign in</button>
        <button class="w-full inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 {GLOSS_OUTLINE}">{icon('key', 'size-4')}Sign in with a passkey</button>
        <div class="flex items-center gap-3 py-1"><div class="h-px flex-1 bg-border"></div><span class="text-[11px] text-muted-foreground">or continue with</span><div class="h-px flex-1 bg-border"></div></div>
        <div class="grid grid-cols-2 gap-2">
          <button class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 {GLOSS_OUTLINE}">{icon('github', 'size-4')}GitHub</button>
          <button class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 {GLOSS_OUTLINE}"><svg class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"/></svg>Google</button>
        </div>
      </div>
      <p class="mt-6 text-center text-xs text-muted-foreground">New to Gigadrive? <a class="text-primary hover:underline font-medium">Create an account</a></p>
    </div>
    <p class="mt-4 text-center text-[11px] text-white/40">Signing in to <span class="text-white/60 font-medium">Gigadrive Console</span> · <a class="hover:text-white/60">Privacy</a> · <a class="hover:text-white/60">Terms</a></p>
  </div>
</div>
</body>
</html>'''

# ═════════ 8. Account security (my.gigadrive.de) ═════════
def item(ic, title, desc, right, danger=False):
    t = 'text-danger' if danger else ''
    return f'''<div class="card-tactile flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5">
      <div class="raised size-9 shrink-0 rounded-lg border border-border bg-card grid place-items-center text-muted-foreground">{icon(ic, 'size-4')}</div>
      <div class="min-w-0 flex-1"><div class="text-sm font-medium {t}">{title}</div><div class="text-xs text-muted-foreground mt-0.5">{desc}</div></div>
      {right}
    </div>'''

manage_btn = f'<button class="inline-flex items-center rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE} shrink-0">Manage</button>'
security_content = f'''{HEAD}
<body class="pb bg-background text-foreground font-sans antialiased">
<div class="flex-1 px-4 py-6 sm:px-8 md:p-14 lg:px-20 min-h-screen">
  <div class="absolute right-6 top-5"><div class="size-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-700"></div></div>
  <div class="lg:flex lg:gap-20 max-w-6xl mx-auto">
    <aside class="hidden w-56 flex-shrink-0 flex-col lg:flex gap-0.5">
      <div class="flex items-center gap-2 px-3 pb-6"><div class="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground font-bold text-sm">G</div><span class="font-semibold text-sm">Account</span></div>
      {nav_item('grid', 'Overview')}
      {nav_item('shield', 'Security', True)}
      {nav_item('zap', 'Connections')}
      {nav_item('card', 'Billing')}
      {nav_item('gear', 'Preferences')}
    </aside>
    <main class="mx-auto min-w-0 max-w-4xl flex-1">
      <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">Security</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage how you sign in and keep your account safe.</p>

      <h2 class="text-sm font-semibold mt-8 mb-3">Passkeys</h2>
      <div class="space-y-2">
        {item('key', 'MacBook Pro — Touch ID', 'Added Mar 12, 2026 · Last used today', manage_btn)}
        {item('phone', 'iPhone 17 Pro', 'Added Jan 4, 2026 · Last used 3 days ago', manage_btn)}
        <button class="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40">{icon('plus', 'size-4')}Add a passkey</button>
      </div>

      <h2 class="text-sm font-semibold mt-8 mb-3">Two-factor authentication</h2>
      <div class="space-y-2">
        {item('shield', 'Authenticator app', 'TOTP enabled · configured Feb 2025', chip('Enabled', 'success', glow=True))}
        {item('file', 'Recovery codes', '8 of 10 codes remaining', manage_btn)}
      </div>

      <h2 class="text-sm font-semibold mt-8 mb-3">Active sessions</h2>
      <div class="space-y-2">
        {item('laptop', 'MacBook Pro — Safari', 'Berlin, Germany · This device', '<span class="raised inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">Current</span>')}
        {item('phone', 'iPhone — Gigadrive App', 'Berlin, Germany · 2 hours ago', f'<button class="inline-flex items-center rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE} shrink-0">Revoke</button>')}
        {item('laptop', 'Windows — Chrome', 'Cologne, Germany · Aug 19, 2026', f'<button class="inline-flex items-center rounded-md text-[13px] font-medium h-8 px-3 {GLOSS_OUTLINE} shrink-0">Revoke</button>')}
      </div>

      <h2 class="text-sm font-semibold mt-8 mb-3 text-danger">Danger zone</h2>
      <div class="rounded-xl border overflow-hidden" style="border-color:hsl(var(--danger)/0.35); background:hsl(var(--card))">
        <div class="flex items-center gap-4 px-4 py-3.5">
          <div class="min-w-0 flex-1"><div class="text-sm font-semibold text-danger">Sign out everywhere</div><div class="text-xs text-muted-foreground mt-0.5">Revokes all sessions including this device.</div></div>
          <button class="raised inline-flex items-center rounded-md text-[13px] font-medium h-8 px-3 border bg-card text-danger hover:bg-danger-soft shrink-0" style="border-color:hsl(var(--danger)/0.4)">Sign out all</button>
        </div>
      </div>
      <div class="h-10"></div>
    </main>
  </div>
</div>
</body>
</html>'''
pages['b-security'] = security_content

for name, html in pages.items():
    with open(f'{name}.html', 'w') as f:
        f.write(html)
    print('wrote', name + '.html')
