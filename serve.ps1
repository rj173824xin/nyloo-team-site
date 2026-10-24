# 战队展示页 · 本地起服务（Windows PowerShell）
# 用法：在本目录右键「用 PowerShell 运行」，或执行  .\serve.ps1
#       .\serve.ps1 -Port 3000   指定端口

param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host ""
Write-Host "  战队展示页 · 本地服务" -ForegroundColor Cyan
Write-Host "  目录：$root"
Write-Host "  地址：http://localhost:$Port"
Write-Host "  停止：Ctrl + C"
Write-Host ""

# 优先用 python，其次用 node
$py = Get-Command python -ErrorAction SilentlyContinue
$py3 = Get-Command py -ErrorAction SilentlyContinue

if ($py) {
    Set-Location $root
    python -m http.server $Port
}
elseif ($py3) {
    Set-Location $root
    py -3 -m http.server $Port
}
elseif (Get-Command node -ErrorAction SilentlyContinue) {
    Set-Location $root
    node -e @"
const http=require('http'),fs=require('fs'),p=require('path');
const T={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
http.createServer((q,s)=>{
  let f=p.join(process.cwd(),decodeURIComponent(q.url.split('?')[0]));
  if(q.url==='/'||q.url==='')f=p.join(process.cwd(),'index.html');
  fs.readFile(f,(e,d)=>{
    if(e){s.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return s.end('404 Not Found: '+q.url);}
    s.writeHead(200,{'Content-Type':T[p.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache'});
    s.end(d);
  });
}).listen($Port,()=>console.log('  OK  http://localhost:'+$Port));
"@
}
else {
    Write-Host "  没找到 python，也没找到 node。" -ForegroundColor Yellow
    Write-Host "  装一个 Python（勾选 Add to PATH）后再运行本脚本。" -ForegroundColor Yellow
    Write-Host "  或者直接双击 index.html —— 但那样读不到 data/team.json，页面会提示你。" -ForegroundColor Yellow
    pause
}