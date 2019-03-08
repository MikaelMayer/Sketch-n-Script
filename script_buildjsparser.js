var fs = require("fs");
var peg = require("pegjs");
var f = "update/javascript.pegjs";
var f2 = "update/jsparser.js";
var parser = peg.generate(fs.readFileSync(f, "utf8"), {output: "source", format: "globals", exportVar: "jsparser"}); 
fs.writeFileSync(f2, parser, "utf8");