test:
	node scripts/testscript.js

buildjsparser:
	node scripts/buildjsparser.js
	uglifyjs --compress --mangle --output update/jsparser-min.js -- update/jsparser.js
	node scripts/buildjsparser2.js