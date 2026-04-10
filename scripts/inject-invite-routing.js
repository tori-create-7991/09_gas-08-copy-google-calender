/**
 * GitHub Actions 用: INVITE_ROUTING_JSON を Config.gs の getInviteRoutingConfig に注入する
 */
var fs = require('fs');

var cfg = JSON.parse(process.env.INVITE_ROUTING_JSON);
var configGs = fs.readFileSync('src/Config.gs', 'utf8');
var replacement =
  '// --- INVITE_ROUTING_START ---\n' +
  'function getInviteRoutingConfig() {\n' +
  '  return ' + JSON.stringify(cfg, null, 2) + ';\n' +
  '}\n' +
  '// --- INVITE_ROUTING_END ---';

configGs = configGs.replace(
  /\/\/ --- INVITE_ROUTING_START ---[\s\S]*?\/\/ --- INVITE_ROUTING_END ---/,
  replacement
);
fs.writeFileSync('src/Config.gs', configGs);
console.log('Injected invite routing config from INVITE_ROUTING_JSON');
