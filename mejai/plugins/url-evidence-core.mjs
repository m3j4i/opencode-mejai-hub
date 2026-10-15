export function canonical(value) {
  try { const u=new URL(value.replace(/&amp;/g,'&')); if(!['http:','https:'].includes(u.protocol))return null; u.hash=''; return u.href; } catch { return null; }
}
export function urlsIn(text) {
  return (String(text||'').match(/https?:\/\/[^\s<>"'`\\]+/g)||[]).map(value=>{
    let url=value.replace(/[.,;]+$/g,'');
    // Preserve balanced parentheses in real paths, e.g. /Title_(edition).
    for(const [open,close] of [['(',')'],['[',']'],['{','}']]){
      while(url.endsWith(close)&&url.split(close).length>url.split(open).length)url=url.slice(0,-1);
    }
    return canonical(url);
  }).filter(Boolean);
}
export function evidenceFrom(messages) {
  const known=new Set();
  for(const m of messages||[])for(const p of m.parts||[]){
    let value=''; const routed=/habilidades_call$/.test(p.tool||'');
    let tool=p.tool||'', args=p.state?.input||{};
    for(let depth=0;depth<4&&/browser_tool_call$|habilidades_call$/.test(tool);depth++){
      tool=args.name||''; args=args.arguments||{};
    }
    if(routed&&p.state?.status==='completed'&&['fetch','searxng','apify','chrome-devtools','tor','tor-browser','github','shadcn','brave','reddit'].includes(p.state?.input?.server)&&!['evaluate_script','browser_evaluate'].includes(tool))value=p.state.output;
    if(m.info?.role==='user'&&p.type==='text')value=p.text;
    if(p.type==='tool'&&p.state?.status==='completed'&&/(context7_|deepwiki_|web_search|websearch|web_fetch|webfetch|browser_(search|navigate|snapshot|click|tabs|find|links|download|evaluate))/.test(tool))value=String(p.state.output||'').split('### Ran Playwright code')[0];
    // Navigation results may put the page snapshot after the generated-code section.
    if(p.type==='tool'&&p.state?.status==='completed'&&/browser_(navigate|snapshot|click|tabs|find)$/.test(tool))value=p.state.output;
    if(p.type==='tool'&&p.state?.status==='completed'&&['bash','start_process'].includes(tool)&&/curl|wget|Invoke-WebRequest|Invoke-RestMethod|requests\.|httpx\.|urllib|fetch\s*\(/i.test(args.command||''))value=p.state.output;
    for(const u of urlsIn(value))known.add(u);
    const pageURL=String(value||'').match(/^- Page URL:\s*(https?:\/\/\S+)/m)?.[1];
    if(pageURL)for(const match of String(value).matchAll(/^\s*- \/url:\s*(.+)$/gm)){
      const href=match[1].trim().replace(/^["']|["']$/g,'');
      try{const url=canonical(new URL(href,pageURL).href);if(url)known.add(url);}catch{}
    }
  }
  return known;
}
export function approved(value,known) {
  const key=canonical(value);if(!key)return false;
  const u=new URL(key);
  if(['localhost','127.0.0.1','[::1]'].includes(u.hostname))return true;
  if(known.has(key))return true;
  // A homepage derived from a discovered URL is a legitimate discovery fallback.
  return u.pathname==='/'&&!u.search&&[...known].some(v=>new URL(v).origin===u.origin);
}


