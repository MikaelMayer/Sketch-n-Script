var fs = require("fs");
var o = (s) => fs.readFileSync(s, "utf8");
eval([
  "esprima.js",
  "Utils.js",
  "RegexUtils.js",
  "Update.js"].map(o).join("\n\n"));
eval(o("test_update.js"));