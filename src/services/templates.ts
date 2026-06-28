export interface ToolTemplate {
  id: string
  name: string
  description: string
  code: string
}

const counter = `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#111;color:#eee}
.n{font-size:64px;font-weight:700;margin:16px}button{font-size:20px;padding:8px 20px;margin:4px;border:none;border-radius:8px;cursor:pointer}
.minus{background:#a33;color:#fff}.plus{background:#3a7;color:#fff}.reset{background:#444;color:#fff}</style></head>
<body><div class="n" id="n">0</div><div><button class="minus" onclick="step(-1)">−</button>
<button class="plus" onclick="step(1)">+</button><button class="reset" onclick="reset()">歸零</button></div>
<script>let c=0;const el=document.getElementById('n');
async function load(){c=(await window.bridge.storage.get('count'))||0;render()}
function render(){el.textContent=c}
async function step(d){c+=d;render();await window.bridge.storage.set('count',c)}
async function reset(){c=0;render();await window.bridge.storage.set('count',0)}
load();</script></body></html>`

const notepad = `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;margin:0;height:100vh;display:flex;flex-direction:column;background:#111;color:#eee}
header{padding:8px 12px;background:#1c1c1c;display:flex;justify-content:space-between;align-items:center}
textarea{flex:1;border:none;outline:none;padding:16px;font-size:16px;background:#111;color:#eee;resize:none}
small{color:#888}</style></head>
<body><header><b>筆記</b><small id="s">已儲存</small></header>
<textarea id="t" placeholder="開始輸入，會自動儲存…"></textarea>
<script>const t=document.getElementById('t'),s=document.getElementById('s');let timer;
async function load(){t.value=(await window.bridge.storage.get('note'))||''}
t.addEventListener('input',()=>{s.textContent='儲存中…';clearTimeout(timer);
timer=setTimeout(async()=>{await window.bridge.storage.set('note',t.value);s.textContent='已儲存'},400)});
load();</script></body></html>`

const jsonFormat = `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;margin:0;padding:12px;background:#111;color:#eee}
textarea{width:100%;box-sizing:border-box;height:40vh;background:#1c1c1c;color:#eee;border:1px solid #333;border-radius:8px;padding:8px;font-family:monospace}
button{margin:8px 0;padding:8px 16px;border:none;border-radius:8px;background:#3a7;color:#fff;cursor:pointer}
pre{background:#1c1c1c;border:1px solid #333;border-radius:8px;padding:8px;overflow:auto;white-space:pre-wrap}
.err{color:#f66}</style></head>
<body><h3>JSON 美化</h3><textarea id="in" placeholder='貼上 JSON…'></textarea>
<div><button onclick="fmt()">美化</button></div><pre id="out"></pre>
<script>function fmt(){const o=document.getElementById('out');try{o.className='';
o.textContent=JSON.stringify(JSON.parse(document.getElementById('in').value),null,2)}
catch(e){o.className='err';o.textContent='解析錯誤：'+e.message}}</script></body></html>`

export const TEMPLATES: ToolTemplate[] = [
  { id: 'counter', name: '計數器', description: '加減計數，數值用 bridge.storage 自動保存', code: counter },
  { id: 'notepad', name: '自動儲存筆記', description: '輸入即自動存檔的純文字筆記', code: notepad },
  { id: 'json', name: 'JSON 美化', description: '貼上 JSON 一鍵格式化', code: jsonFormat },
]
