var fs = require("fs");
var o = (s) => fs.readFileSync(s, "utf8");
eval(o("esprima.js"));
esprima = module.exports;
Syntax = esprima.Syntax;
Node = esprima.Node;
eval([
  "Utils.js",
  "RegexUtils.js",
  "Update.js"].map(o).join("\n\n"));
eval(o("test_update.js"));