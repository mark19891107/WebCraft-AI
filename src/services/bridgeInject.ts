// 內聯注入到每個工具 iframe 的 bridge 腳本（字串）。
// srcdoc iframe 的 origin 為 null，無法用 URL 載入外部腳本，因此以字串內聯。

export const BRIDGE_INJECT_SCRIPT = `
(function () {
  // 將工具的執行期錯誤回報給主頁面（供自動修復使用）
  function reportError(message, stack) {
    try {
      window.parent.postMessage({ __wcToolError: true, message: String(message || 'Unknown error'), stack: stack || '' }, '*');
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    var loc = e.lineno ? (' (line ' + e.lineno + (e.colno ? ':' + e.colno : '') + ')') : '';
    reportError((e.message || 'Script error') + loc, e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    reportError('Unhandled promise rejection: ' + ((r && r.message) || r), r && r.stack);
  });

  var _reqId = 0;
  function call(type, payload, onChunk) {
    return new Promise(function (resolve, reject) {
      var requestId = 'br_' + (++_reqId);
      var chunks = [];
      function handler(event) {
        var msg = event.data;
        if (!msg || msg.requestId !== requestId) return;
        if (msg.error) {
          window.removeEventListener('message', handler);
          reject(new Error(msg.error));
        } else if (msg.done) {
          window.removeEventListener('message', handler);
          resolve(msg.result !== undefined ? msg.result : chunks.join(''));
        } else if (msg.chunk !== undefined) {
          chunks.push(msg.chunk);
          if (onChunk) { try { onChunk(msg.chunk); } catch (e) {} }
        }
      }
      window.addEventListener('message', handler);
      var message = Object.assign({ type: type, requestId: requestId }, payload);
      window.parent.postMessage(message, '*');
    });
  }
  window.bridge = {
    llm: {
      chat: function (messages, options) {
        options = options || {};
        return call('llm.chat', { messages: messages, system: options.system, json: options.json }, options.onChunk);
      }
    },
    data: {
      read: function (name, options) {
        options = options || {};
        return call('data.read', { name: name, rows: options.rows, offset: options.offset });
      }
    },
    mcp: {
      call: function (serverName, tool, params) {
        return call('mcp.call', { serverName: serverName, tool: tool, params: params });
      },
      listTools: function (serverName) {
        return call('mcp.listTools', { serverName: serverName });
      }
    },
    api: {
      fetch: function (name, options) {
        return call('api.fetch', { name: name, options: options });
      }
    },
    storage: {
      get: function (key) { return call('storage.get', { key: key }); },
      set: function (key, value) { return call('storage.set', { key: key, value: value }); },
      remove: function (key) { return call('storage.remove', { key: key }); },
      keys: function () { return call('storage.keys', {}); }
    }
  };
})();
`

// 將 bridge 腳本內聯進工具 HTML
export function injectBridge(html: string): string {
  const tag = `<script>${BRIDGE_INJECT_SCRIPT}</script>`
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`)
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}\n${tag}`)
  }
  return `${tag}\n${html}`
}
