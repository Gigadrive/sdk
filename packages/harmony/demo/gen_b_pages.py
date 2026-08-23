#!/usr/bin/env python3
"""Generate Proposal B (Tactile) mockups of real Gigadrive pages."""

ICONS = {
    'grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
    'db': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>',
    'pulse': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'card': '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'dots': '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    'chevrons': '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    'chevronL': '<path d="m15 18-6-6 6-6"/>',
    'sparkle': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'book': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    'branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'checkcircle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    'folder': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.83 0L6 21"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'key': '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    'phone': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    'laptop': '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
    'github': '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'terminal': '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
}

def icon(name, cls='size-4'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>'

HEAD = '''<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="https://static-cdn.gigadrivegroup.com/resist-sans/stylesheet.css?v2" />
<link rel="stylesheet" href="demo.css" />
<link rel="stylesheet" href="theme-b.css" />
<style>body { margin: 0; } html.dark, .dark { color-scheme: dark; }</style>
<script>if (location.search.includes('dark')) document.documentElement.classList.add('dark');</script>
</head>'''

GLOSS_PRIMARY = 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.25)] bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_40%,transparent_60%)]'
GLOSS_OUTLINE = 'raised border border-input bg-card hover:bg-accent'
PANEL_SHADOW = 'shadow-[0_1px_3px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.02)]'

def nav_item(ic, label, active=False, badge=None):
    if active:
        cls = 'relative flex w-full items-center justify-between rounded-lg pl-3 pr-3 py-2 text-sm bg-primary/10 text-primary font-medium'
        bar = '<span class="pointer-events-none absolute inset-y-0 my-auto h-5 w-[3px] bg-primary left-0 rounded-r-full"></span>'
    else:
        cls = 'relative flex w-full items-center justify-between rounded-lg pl-3 pr-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
        bar = ''
    b = f'<span class="ml-auto text-[11px] text-muted-foreground tabular-nums">{badge}</span>' if badge else ''
    return f'''<a class="{cls}">{bar}<span class="flex items-center gap-2">{icon(ic)}{label}</span>{b}</a>'''

def sidebar(items, layer_header=None, footer_meter=True):
    header = ''
    if layer_header:
        header = f'''<button class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 mb-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground w-full">{icon('chevronL', 'size-3.5')}{layer_header}</button>'''
    meter = ''
    if footer_meter:
        meter = '''<div class="mx-0.5 mb-2 rounded-lg border border-border bg-card/60 p-2.5">
        <div class="flex items-center justify-between"><span class="text-[11px] font-medium">Compute usage</span><span class="text-[11px] text-muted-foreground tabular-nums">41%</span></div>
        <div class="well mt-1.5 h-1.5 w-full rounded-full bg-muted"><div class="fill-gloss h-1.5 rounded-full" style="width:41%"></div></div>
        <div class="mt-1 text-[11px] text-muted-foreground">412.6 of 1,000 h</div>
      </div>'''
    return f'''<aside class="w-60 shrink-0 flex flex-col px-2 pb-2">
      <nav class="space-y-0.5 flex-1 pt-1">
        {header}
        {items}
      </nav>
      {meter}
      <div class="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <div class="size-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-700"></div>
        <div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">Jane Doe</div><div class="text-xs text-muted-foreground truncate">Pro plan</div></div>
      </div>
    </aside>'''

def crumb_btn(label, dot=False, bold=True):
    d = f'<span class="size-1.5 rounded-full" style="background:hsl(var(--success))"></span>' if dot else ''
    w = 'font-medium' if bold else ''
    return f'''<button class="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted {w}">{d}{label}{icon('chevrons', 'size-3 text-muted-foreground')}</button>'''

def navbar(crumbs):
    sep = '<span class="text-muted-foreground/50">/</span>'
    return f'''<nav class="flex h-12 shrink-0 items-center px-4 gap-2">
    <div class="size-6 rounded-md bg-primary grid place-items-center text-primary-foreground font-bold text-xs">G</div>
    <div class="flex items-center gap-1 text-sm">{sep.join(crumbs)}</div>
    <div class="flex flex-1 items-center justify-end gap-2">
      <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-8 px-3 {GLOSS_OUTLINE}">Feedback</button>
      <div class="size-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-700"></div>
    </div>
  </nav>'''

RAIL = f'''<aside class="w-[3.25rem] shrink-0 flex flex-col items-center gap-1 pt-2 pb-3">
      <button class="size-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{icon('sparkle')}</button>
      <button class="size-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{icon('pulse')}</button>
      <button class="size-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground relative">{icon('bell')}<span class="absolute right-2 top-2 size-1.5 rounded-full" style="background:hsl(var(--danger))"></span></button>
      <button class="size-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{icon('book')}</button>
      <div class="mt-auto"></div>
      <button class="size-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{icon('help')}</button>
    </aside>'''

DARK_PANEL_JS = '''<script>
  if (document.documentElement.classList.contains('dark')) {
    var p = document.getElementById('panel');
    if (p) p.style.boxShadow = 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.45), 0 12px 32px -16px rgba(0,0,0,0.6)';
  }
</script>'''

def console_page(crumbs, side, content):
    return f'''{HEAD}
<body class="pb bg-background text-foreground font-sans antialiased">
<div class="flex h-screen w-screen flex-col bg-muted/40 overflow-hidden">
  {navbar(crumbs)}
  <div class="flex flex-1 min-h-0">
    {side}
    <main class="flex-1 min-w-0 my-2 rounded-xl border border-border/60 bg-background overflow-auto flex flex-col {PANEL_SHADOW}" id="panel">
{content}
    </main>
    {RAIL}
  </div>
</div>
{DARK_PANEL_JS}
</body>
</html>'''

def chip(status, color, glow=False, soft=False):
    if soft:
        return f'<span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium bg-{color}-soft text-{color}" style="border-color:hsl(var(--{color})/0.3)"><span class="size-1.5 rounded-full" style="background:hsl(var(--{color}))"></span>{status}</span>'
    g = f'; box-shadow:0 0 5px hsl(var(--{color})/0.6)' if glow else ''
    dot = f'<span class="size-1.5 rounded-full" style="background:hsl(var(--{color})){g}"></span>' if color != 'muted' else '<span class="size-1.5 rounded-full bg-muted-foreground/50"></span>'
    mut = ' text-muted-foreground' if color == 'muted' else ''
    return f'<span class="raised inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium{mut}">{dot}{status}</span>'

# ── Sidebars ────────────────────────────────────────────────────────────────

SIDE_ORG = lambda active: sidebar('\n'.join([
    nav_item('grid', 'Overview', active == 'overview'),
    nav_item('rocket', 'Deployments', active == 'deployments', '38'),
    nav_item('pulse', 'Usage', active == 'usage'),
    nav_item('card', 'Billing', active == 'billing'),
    nav_item('gear', 'Settings', active == 'settings'),
]))

SIDE_APP = lambda active: sidebar('\n'.join([
    nav_item('grid', 'Overview', active == 'overview'),
    nav_item('rocket', 'Deployments', active == 'deployments', '12'),
    nav_item('pulse', 'Observability', active == 'observability'),
    nav_item('terminal', 'Logs', active == 'logs'),
    nav_item('box', 'Storage', active == 'storage'),
    nav_item('gear', 'Settings', active == 'settings'),
]), layer_header='Gigadrive GmbH')

print('generator loaded')
