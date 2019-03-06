test:
	node -e 'var fs = require("fs"); var f = "Utils.js"; var f2 = "update/Update.js"; var f3 = "tests/testupdate.js"; var o = (s) => fs.readFileSync(s, "utf8"); eval(["Utils.js", "RegexUtils.js", "update/Update.js"].map(o).join("\n\n")); eval(o(f3));'

buildjsparser:
	node -e 'var fs = require("fs"); var peg = require("pegjs"); var f = "update/javascript.pegjs"; var f2 = "update/jsparser.js"; var parser = peg.generate(fs.readFileSync(f, "utf8"), {output: "source", format: "globals", exportVar: "jsparser"}); fs.writeFileSync(f2, parser, "utf8");'
	uglifyjs --compress --mangle --output update/jsparser-min.js -- update/jsparser.js
	node -e 'var fs = require("fs");  var f = "update/jsparser-min.js"; fs.writeFileSync(f, "var jsparse__ = null;\nfunction jsparse() {\n  if(jsparse__)\n    return jsparse__.jsparser;\n  jsparse__ = {};\n  " + fs.readFileSync(f, "utf8").replace(/([;=,\}\{])(function)/g, (_, g1, g2) => g1 + "\n" + g2).replace(/\(this\);/, "(jsparse__);") + "\n  return jsparse__.jsparser;\n}", "utf8")'
	rm update/jsparser.js