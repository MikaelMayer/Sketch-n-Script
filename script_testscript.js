var fs = require("fs");
var f = "Utils.js";
var f2 = "update/Update.js";
var f3 = "tests/testupdate.js";
var o = (s) => fs.readFileSync(s, "utf8");
eval(["Utils.js", "RegexUtils.js", "update/Update.js"].map(o).join("\n\n"));
eval(o(f3));