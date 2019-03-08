var fs = require("fs");
var f = "update/jsparser-min.js";
var newContent = "\
var jsparserCache = null;\n\
function jsparser() {\n\
  if(jsparserCache)\n\
  return jsparserCache.jsparser;\n\
  jsparserCache = {};\n\
  " + fs.readFileSync(f, "utf8").replace(/([;=,\}\{])(function)/g, (_, g1, g2) => g1 + "\n" + g2).replace(/\(this\);/, "(jsparserCache);") + "\n\
  return jsparserCache.jsparser;\n\
}";
fs.writeFileSync(f, newContent, "utf8")