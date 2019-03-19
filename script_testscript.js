var fs = require("fs");
var o = (s) => fs.readFileSync(s, "utf8");
eval(o("add-on/esprima.js"));
esprima = module.exports;
Syntax = esprima.Syntax;
Node = esprima.Node;
syntax = { Syntax: Syntax};
eval([
  "add-on/Utils.js",
  "add-on/RegexUtils.js",
  "add-on/Update.js"].map(o).join("\n\n"));
eval(o("test_update.js"));