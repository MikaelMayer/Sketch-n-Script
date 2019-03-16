test:
	node script_testscript.js

minifyesprima:
	uglifyjs --compress --mangle --output esprima-min.js -- esprima.js
