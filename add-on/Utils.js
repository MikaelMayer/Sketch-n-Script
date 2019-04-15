function isLetter(s) {
  return /^[a-zA-Z0-9_\$]$/.exec(s);
}

function endsWithLetter(s) {
  return s.length > 0 && isLetter(s[s.length - 1]);
}

function wrapsWithParens(s) {
  return s.replace(/^(=?)(?!\(|\[|=)([\s\S]*)$/,
            function(match, eq, content) { return eq + "(" + content + ")"; });
}

//////// Array Manipulation ///////////////

function arrayAll(array, predicate) {
  for(var i in array) {
    if(!predicate(array[i], i)) return false;
  }
  return true;
}

//////// result Manipulation ///////////////

function Ok(x) {
  return {ctor: "Ok", _0: x}
}

function Err(x) {
  return {ctor: "Err", _0: x}
}

function resultCase(x, errCallback, okCallback) {
  if(x.ctor == "Ok") {
    return okCallback(x._0);
  }
  return errCallback(x._0);
}

//////// Diff manipulation ////////////////
function bindDiff(headDiff, tailDiffs) {
  return headDiff || tailDiffs;
}

//////// List Manipulation ///////////////

function cons_(head, tail) {
  if(head && tail && bindDiff(head.diffs, tail.diffs)) {
    return {head: head, tail: tail, diffs: true}
  }
  return {head: head, tail: tail}
}
function nil_()  {
  return undefined;
}

var List = {
  // A foreach which stops if the callback returns true
  foreach: function(list, callback) {
    while(list && list.head) {
      var c = callback(list.head);
      if(c) return c;
      list = list.tail;
    }
  },
  drop: function(list, number) {
    while(list && list.head && number) {
      list = list.tail;
      number--;
    }
    return list;
  },
  reverseInsert: function(toInsert, list) {
    while(toInsert && toInsert.head) {
      list = {head: toInsert.head, tail: list}
      toInsert = toInsert.tail;
    }
    return list;
  },
  length: function(list) {
    var result = 0;
    while(list) {
      list = list.tail;
      result++;
    }
    return result;
  },
  toArray: function(list, map) {
    var result = [];
    var index = 0;
    while(list) {
      result.push(map ? map(list.head, index) : list.head);
      list = list.tail;
      index++;
    }
  },
  fromArray: function(array, list)  {
    for(var i = array.length - 1; i >= 0; i--) {
      list = cons_(array[i], list);
    }
    return list;
  },
  mkString: function(list, callback) {
    let i = 0;
    let result = "";
    while(typeof list !== "undefined") {
      result += typeof callback !== "undefined" ? callback(list.head, i) : list.head;
      list = list.tail;
      i++;
    }
    return result;
  },
  builder: function() {
    var initList = undefined;
    var insertList = undefined;
    return {
      append: function(elem) {
        if(typeof insertList === "undefined") {
          initList = {head: elem, tail: undefined};
          insertList = initList;
        } else {
          insertList.tail = {head: elem, tail: undefined};
          insertList = insertList.tail;
        }
        return this;
      },
      build: function() {
        return initList;
      }
    }
  }
}

///////// Environment manipulation /////////////////

/* environment =
     false
   | { head: {name: String,
              value: { v_,
                       expr : {name?, source, sourceType, range: Range, oldValue?, newValue?},
                       env : environment}
              diffs?: bool},
       tail: environment,
       diffs?: bool]
*/

function mergeValues(original, value1, value2) {
  var so = uneval_(original);
  var s1 = uneval_(value1);
  if(so == s1) return value2;
  return value1;
}

function mergeBinding(binding1, binding2) {
  if(!binding1.diffs) return binding2;
  if(!binding2.diffs) return binding1;
  return binding1; // For now, we just select a binding. Later, we'll merge the updates.
}

function mergeUpdatedEnvs(updatedEnv1, updatedEnv2) {
  if(!updatedEnv1 || !updatedEnv2) return Ok(updatedEnv1);
  if(!updatedEnv1.diffs) return Ok(updatedEnv2);
  if(!updatedEnv2.diffs) return Ok(updatedEnv1);
  return resultCase(
    mergeUpdatedEnvs(updatedEnv1.tail, updatedEnv2.tail), Err,
    function(updatedTail) {
      return Ok(cons_(mergeBinding(updatedEnv1.head, updatedEnv2.head), updatedTail));
    });
}

// Returns the binding associated to the given name if any.
function lookup_(env, name) {
  var result = undefined;
  List.foreach(env, function(head) {
    if(head.name == name) {
      result = Ok(head);
      return true;
    }
  });
  return result ? result : Err(name + " not found in environment variables");
}

function updateVar_(env, name, oldValueToNewValue) {
  var rebuildEnv = function(env) { return env; };
  while(env && env.head) {
    if(env.head.name == name) {
      return rebuildEnv(cons_({
        name: env.head.name,
        value: oldValueToNewValue(env.head.value),
        diffs: true}, env.tail))
    } else {
      rebuildEnv = (function(head, rebuildEnv) {
        return function(tail) {
          return rebuildEnv(cons_(head, tail)) }; })(env.head, rebuildEnv);
      env = env.tail;
    }
  }
  return rebuildEnv(env); 
}

function evaluate_(env, $$source$$$) {
  var envJS = buildEnvJS_(env);
  with(envJS) {
    return eval($$source$$$);
  }
}


// From a list environment, builds an object environment suitable for with(result) { eval...}
// Caches every environment.
function buildEnvJS_(env) {
  if(typeof env !== "object") return {};
  if(typeof env.cache !== "undefined") return env.cache;
  var result = {};
  List.foreach(env, function(head) {
    if(typeof result[head.name] === "undefined") {
      result[head.name] = head.value.v_;
    }
  });
  env.cache = result;
  return result;
}

// Re-evaluates all entries from the env
function reeval(env) {
  if(typeof env !== "object") return;
  reeval(env.tail);
  env.cache = undefined;
  if(!env.head.value.expr) return;
  var formula = formulaOf_(env.head.value.expr);
  var newV_ = evaluate_(env.tail, formula);
  env.head.value.v_ = newV_;
}


function uneval_(x, indent) {
  if(typeof x == "string") {
    return toExpString(x);
  }
  if(typeof x == "number" || typeof x == "boolean") {
    return x;
  }
  if(typeof x == "object" && x == null) {
    return "null";
  }
  if(typeof x == "object") {
    var result = [];
    var isSmall = Object.keys(x).length <= 1;
    var newline = typeof indent == "undefined" || isSmall ? "" : "\n" + indent;
    var separator = newline + ", ";
    var newIndent = typeof indent == "undefined" ? indent : indent + "  ";
    if(Array.isArray(x)) { // Arrays
      for(var i = 0; i < x.length; i++) {
        result.push(uneval_(x[i], newIndent));
      }
      return "[ " + result.join(separator) + "]";
    }
    for(var k in x) {
      result.push(k + ": " + (typeof x[k] == "object" ? newline + "  " : "") + uneval_(x[k], newIndent));
    }
    return "{ " + result.join(separator) + "}";
  }
  return "" + x;
}


//////// String Manipulation ///////////////

function sanitizeQuotes_(txt) {
  return txt.replace(/“/g, "\"").replace(/”/g, "\"");
}


function diff(before, after) {
    // Create a map from before values to their indices
    var oldIndexMap = {}, i;
    for (i = 0; i < before.length; i ++) {
        oldIndexMap[before[i]] = oldIndexMap[before[i]] || [];
        oldIndexMap[before[i]].push(i);
    }

    var overlap = [], startOld, startNew, subLength, inew;
    
    startOld = startNew = subLength = 0;

    for (inew = 0; inew < after.length; inew++) {
        var _overlap                = [];
        oldIndexMap[after[inew]]    = oldIndexMap[after[inew]] || [];
        for (i = 0; i < oldIndexMap[after[inew]].length; i++) {
            var iold        = oldIndexMap[after[inew]][i];
            _overlap[iold]  = ((iold && overlap[iold-1]) || 0) + 1;
            if (_overlap[iold] > subLength) {
                subLength   = _overlap[iold];
                startOld    = iold - subLength + 1;
                startNew    = inew - subLength + 1;
            }
        }
        overlap = _overlap;
    }

    if (subLength === 0) {
        // If no common substring is found, we return an insert and delete...
        var result = [];
        before.length && result.push(['-', before]);
        after.length  && result.push(['+', after]);
        return result;
    }

    // ...otherwise, the common substring is unchanged and we recursively
    // diff the text before and after that substring
    return [].concat(
        diff(before.slice(0, startOld), after.slice(0, startNew)),
        [['=', after.slice(startNew, startNew + subLength)]],
        diff(before.slice(startOld + subLength), after.slice(startNew + subLength))
    );
};

function testMergeModification() {
  Logger.log(mergeModifications("ABCDEFGHIJKL", "ADEXYGHKLMPD", "ADEZGHJKLBNP"))
}

// Creates a manual merge of modifications. Finds where it differs, line by line.
function mergeModifications(original, modified1, modified2) {
  var diff1 = diff(original, modified1);
  var diff2 = diff(original, modified2);
  var result = "";
  
  while(diff1.length && diff2.length) {
    var d1 = diff1.shift();
    var d2 = diff2.shift();
    if(d1[0] == '=' && d2[0] == '=') {
      var m = Math.min(d1[1].length, d2[1].length);
      result += d1[1].substring(0, m);
      if(d1[1].length > m) {
        diff1.unshift(["=", d1[1].substring(m)]);
      }
      if(d2[1].length > m) {
        diff2.unshift(["=", d2[1].substring(m)]);
      }
      continue;
    }
    if(d1[0] == '-' && d2[0] == '-') { // Let's make these deletions the same size.
      var m = Math.min(d1[1].length, d2[1].length);
      if(d1[1].length > m) {
        diff1.unshift(["-", d1[1].substring(m)]);
        diff1.unshift(["-", d1[1].substring(0, m)]);
        diff2.unshift(d2);
        continue;
      }
      if(d2[1].length > m) {
        diff2.unshift(["-", d2[1].substring(m)]);
        diff2.unshift(["-", dé[1].substring(0, m)]);
        diff1.unshift(d1);
        continue;
      }
      // Here the two texts delete the same stuff
      // Two deletions, if they are both followed by insertions, conflict !
      if(diff1.length > 0 && diff2.length > 0) {
        if(diff1[0][0] == '+' && diff2[0][0] == '+') {
          result += "[Conflict removing:" + d1[1] + "|Remote:" + diff1[0][1] + "|Yours:" + diff2[0][1] + "]";
          diff1.shift();
          diff2.shift();
          continue;
        }
      }
      // Deletions are consistent, we continue;
      continue;
    }
    if(d1[0] == '=' && d2[0] == '-') {
      var m = Math.min(d1[1].length, d2[1].length);
      if(d1[1].length > m) {
        diff1.unshift(["=", d1[1].substring(m)]);
      }
      if(d2[1].length > m) {
        diff2.unshift(["-", d2[1].substring(m)]);
      }
      continue;
    }
    if(d1[0] == '-' && d2[0] == '=') {
      var m = Math.min(d1[1].length, d2[1].length);
      if(d1[1].length > m) {
        diff1.unshift(["-", d1[1].substring(m)]);
      }
      if(d2[1].length > m) {
        diff2.unshift(["=", d2[1].substring(m)]);
      }
      continue;
    }
    if(d1[0] == '+') {
      result += d1[1];
      diff2.unshift(d2);
      continue;
    }
    if(d2[0] == '+') {
      result += d2[1];
      diff1.unshift(d1);
    }
  }
  while(diff1.length) {
    var d1 = diff1.shift();
    if(d1[0] == '+' || d1[0] == '=') {
      result += d1[1];
    }
  }
  while(diff2.length) {
    var d2 = diff2.shift();
    if(d2[0] == '+' || d2[0] == '=') {
      result += d2[1];
    }
  }
  return result;
}

/////// Javascript Source Manipulation ////////////////

var isStr = function(c) { return c == "\"" || c == "'" || c == "`" };

function nextOffsetDelimiters_(s, o, delimiters) {
  var c = s[o];
  if(delimiters.length > 0 && delimiters[0] == c)
    return [o + 1, delimiters.shift()]; 
  if(delimiters.length > 0 && delimiters[0] == "`" && c == "$" && o + 1 < s.length && s[o + 1] == "{")
    return [o + 2, delimiters.unshift("}")] 
  if(delimiters.length > 0 && isStr(delimiters[0]) && c == "\\" && o + 1 < s.length)
    return [o + 2, delimiters]
  if(delimiters.length > 0 && isStr(delimiters[0])) // Inside a string
    return [o + 1, delimiters];
  if(isStr(c)) return [o + 1, delimiters.unshift(c)];
  if(c == "(") return [o + 1, delimiters.unshift(")")];
  if(c == "[") return [o + 1, delimiters.unshift("]")];
  if(c == "{") return [o + 1, delimiters.unshift("}")];
  if(delimiters.length > 0)
    return [o + 1, delimiters];
  else
    return [o, delimiters];
}

// Fast parsing: Find the tightest end of the expression knowing it starts with a variable (possibly followed by a delimiter) or a delimiter
// TODO: It's not compatible with comments.
// TODO: We might want not the tightest, but the longest until a closing delimiter is found (e.g. ')', ']', or ',')

function getEndOffsetInclusiveFormula_(string, endOffsetInclusive, includeNames) {
  string = sanitizeQuotes_(string);
  var delimiters = [];
  while(string.length > endOffsetInclusive &&
        (includeNames ? /[a-zA-Z0-9_$@]/ : /[a-zA-Z0-9_$]/).exec(string[endOffsetInclusive])) {
    endOffsetInclusive++;
  }
  endOffsetInclusive--; // So that this is the last char that was a letter
  var endOffsetExclusive = endOffsetInclusive + 1;
  while(endOffsetExclusive < string.length) {
    var [endOffsetExclusive, _] = nextOffsetDelimiters_(string, endOffsetExclusive, delimiters);
    if(delimiters.length == 0) {
      break;
    }
  }
  if(delimiters.length > 0) {
    return -1;
  }
  return endOffsetExclusive - 1;
}

function toExpString(string, charDelim) {
  charDelim = charDelim == "\"" || charDelim == "`" || charDelim == "'" ? charDelim : "\"";
  return charDelim + string
        .replace(new RegExp(bs, "g"), bs)
        .replace(new RegExp(charDelim, "g"), "\\" + charDelim)
        .replace(new RegExp("\n", "g"), "\\n")
        .replace(new RegExp("\t", "g"), "\\t")
        + charDelim
}


// Calls the correct field of cases with the method associated to what it is parsing in formula.
function jsFormulaCase(formula, cases) {
  var x = new RegExp("^("+ws+")(.*?)("+ws+")$");
  x.lastIndex = 0;
  var m = x.exec(formula);
  if(m && m[1] != "" || m[3] != "") {
    return cases.whitespaces(m[1], m[2], m[3]);
  }
  x = new RegExp("^" + stringRegex + "$");
  x.lastIndex = 0;
  m = x.exec(formula);
  if(m) {
    return cases.string(formula);
  }
  x = new RegExp("^" + numberRegex + "$");
  x.lastIndex = 0;
  m = x.exec(formula);
  if(m) {
    return cases.number(parseInt(m[0]), m[0]);
  }
  // Find the offset until the end of the first complete expression (variable, parentheses or call)
  var endInclusive = getEndOffsetInclusiveFormula_(formula, 0);
  if(endInclusive == formula.length - 1) { // whole match
    if(formula.length >= 0 && formula[0] == "(" && formula[formula.length - 1] == ")") {
      // Parentheses
      return cases.parentheses(formula.substring(1, formula.length - 1));
    }
    x = new RegExp("^" + varName + "$");
    x.lastIndex = 0;
    m = x.exec(formula);
    if(m) {
      if(m[0] == "true" || m[0] == "false") {
        // booleans
        return cases.boolean(m[0] == "true");
      }
      // Variable
      return cases.variable(m[0]);
    }
    // TODO: Handle arrays
    // TODO: Built-in functions?
  }
  x = new RegExp("^("+ws+")(\\+|\\*|\\*\\*|\\?|\\.|\\:|;|===|==|!=|!==|<|<=|>|>=|<<|>>)"); // We don't do more than that for the moment.
  var m2 = x.exec(formula.substring(endInclusive + 1));
  if(m2) {
    var wsBefore = m2[1];
    var operator = m2[2];
    return cases.operator(
      formula.substring(0, endInclusive + 1),
      wsBefore,
      operator,
      formula.substring(endInclusive + 1 + wsBefore.length + operator.length))
  }
  /* TODO: Extract operators
    /*x = new RegExp("^("+ws+")\\+("+ws+")(.*)$");
    m = x.exec(oldFormula.substring(endInclusive + 1));
    if(m) { // Concatenation.
      
    }*/
  return cases.orElse(formula);
}


function isRichText_(value) {
    return typeof value == "object" &&
        Array.isArray(value) &&
        value.length === 2 &&
        (typeof value[0] == "string" || typeof value[0] == "number" || typeof value[0] == "boolean") &&
        typeof value[1] == "object";
}
function isElement_(value) {
    return typeof value == "object" &&
        Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] == "string" &&
        typeof value[1] == "object";
}


function testReconcile() {
  Logger.log(uneval_(reconcileAsMuchAsPossible_("noprops", ["noprops", {italic: true}])));
  Logger.log(uneval_(reconcileAsMuchAsPossible_("1", 2)));
  Logger.log(uneval_(reconcileAsMuchAsPossible_("seventy", 2)));
  Logger.log(uneval_(reconcileAsMuchAsPossible_("false", true)));
  Logger.log(uneval_(reconcileAsMuchAsPossible_(["p", {}, ["test"]], "hello")));
  Logger.log(uneval_(reconcileAsMuchAsPossible_(["hallo"], "hello")));
  Logger.log(uneval_(reconcileAsMuchAsPossible_(["p", {}, "hallo"], "hallo")));
  Logger.log(uneval_(reconcileAsMuchAsPossible_("hallo", ["hello", {italic: true}])));
  Logger.log(uneval_(reconcileAsMuchAsPossible_(["p", {}, ["hallo"]], ["paragraph", {blah: 1}, "hello"])))
  Logger.log(uneval_(reconcileAsMuchAsPossible_(["table", {}, [["hallo"]]], ["TABLE", {blah: 1}, "hello"])))
  Logger.log(uneval_(reconcileAsMuchAsPossible_(["img", {}, []], ["image", {src: "blah"}, ["unused"]])))
}

// Here oldValues is an expression as simple as possible.
// computedValues is a value obtained from the document,
// so it does not contain integers, booleans, and might wrap texts in paragraphs for example. 
// Cf. function valuesToElementsToInsert_
function reconcileAsMuchAsPossible_(computedValues, oldValues) {
  //Logger.log("reconcileAsMuchAsPossible_(" + uneval_(computedValues) + ", " + uneval_(oldValues) + ")")
  if(typeof oldValues === "undefined") return computedValues;
  if(( typeof computedValues == "string") &&
     (typeof oldValues == "string" ||
      typeof oldValues == "number" ||
      typeof oldValues == "boolean")) {
    // TODO: coerce if possible.
    if(typeof oldValues == "number") {
      var number = parseInt(computedValues);
      if(number !== number && computedValues !== "NaN") {
        return computedValues;
      }
      return number;
    }
    if(typeof oldValues == "boolean") return computedValues.toLowerCase() == "true";
    return computedValues;
  }
  if(isElement_(computedValues) && computedValues[0] == "p" && ( typeof oldValues == "string" ||
       typeof oldValues == "number" ||
       typeof oldValues == "boolean")) {
    return reconcileAsMuchAsPossible_(computedValues[2], oldValues);
  }
  
  if((isElement_(oldValues) ||
     typeof oldValues == "string" ||
     typeof oldValues == "number" ||
     typeof oldValues == "boolean" ||
     isRichText_(oldValues)) &&
     Array.isArray(computedValues) && computedValues.length == 1
    ) {
    return reconcileAsMuchAsPossible_(computedValues[0], oldValues); 
  }
  // We copy the attributes there so that they are not considered a difference
  if(isElement_(oldValues) && isElement_(computedValues)) {
    // If tags are compatible, make sure we propagate the correct one.
    var oldTag = oldValues[0];
    var newTag = computedValues[0];
    if((oldTag.toLowerCase() == "img" || oldTag.toLowerCase() == "image") &&
      (newTag.toLowerCase() == "img")) {
        return [oldTag, oldValues[1], oldValues[2]];
      }
    if((oldTag.toLowerCase() == "paragraph" || oldTag.toLowerCase() == "p") &&
      (newTag.toLowerCase() == "p")) {
        return [oldTag, oldValues[1], reconcileAsMuchAsPossible_(computedValues[2], oldValues[2])];
      }
    if((oldTag.toLowerCase() == "listitem" || oldTag.toLowerCase() == "li") &&
      (newTag.toLowerCase() == "li")) {
        return [oldTag, oldValues[1], reconcileAsMuchAsPossible_(computedValues[2], oldValues[2])];
      }
    if(oldTag.toLowerCase() == "table" && newTag.toLowerCase() == "table") {
      var oldRows = valuestoArray_(oldValues[2]);
      return [oldTag, oldValues[1],
              reconcileAsMuchAsPossible_(computedValues[2], oldValues[2])]
    }
  }
  if(typeof computedValues == "object" && typeof oldValues === "object" &&
     Array.isArray(computedValues) && Array.isArray(oldValues) &&
    !isRichText_(computedValues) && !isRichText_(oldValues) &&
    !isElement_(computedValues) && !isElement_(oldValues)
    ) {
      if(computedValues.length == oldValues.length) {
        return computedValues.map(function(computedValue, k) {
          return reconcileAsMuchAsPossible_(computedValue, oldValues[k]);
        })
      } else {
        // TODO : Find insertions, deletions and/or reorderings.
        return computedValues;
      }
  }
  return computedValues;
}


function testAreDifferentValues() {
  Logger.log(areDifferentValues_(1, '1')); // true
  Logger.log(areDifferentValues_(0, '')); // true
  Logger.log(areDifferentValues_([1, 2], [1, 2])); // false
  Logger.log(areDifferentValues_([1, 2], [1, 2, 3])); // true
  Logger.log(areDifferentValues_([1, 2, 3], [1, 2])); // true
  Logger.log(areDifferentValues_({a: 1}, {a: 1, b: 2})); // true
  Logger.log(areDifferentValues_({a: 1, b: 2}, {a: 1})); // true
  Logger.log(areDifferentValues_({a: 1, b: 2}, {a: 1, b: 3})); // true
  Logger.log(areDifferentValues_({a: 1, b: 2}, {a: 1, b: 2})); // false
}

function areDifferentValues_(oldOutput, newOutput) {
  var to = typeof oldOutput;
  var tn = typeof newOutput;
  return (to !== tn) || 
        ((to === "string" || to == "number" || to == "boolean" || to === "undefined") &&
         (tn === "string" || tn == "number" || tn == "boolean" || tn === "undefined") &&
          oldOutput !== newOutput) || (
          Array.isArray(oldOutput) && (oldOutput.length !== newOutput.length ||
             oldOutput.some(function(o, k) {
          return areDifferentValues_(o, newOutput[k]); }))) ||
            (function() {
              for(var k in oldOutput) {
                if(areDifferentValues_(oldOutput[k], newOutput[k])) return true;
              }
              for(var k in newOutput) {
                if(areDifferentValues_(oldOutput[k], newOutput[k])) return true;
              }
              return false;
            })()
}
/*
function testSameAsValue() {
  Logger.log("true:"+ sameAsValue("[1, 2]"))
  Logger.log("false:"+ sameAsValue("[1, a]"))
  Logger.log("true:"+ sameAsValue("[1, {a: 1}]"))
  Logger.log("true:"+ sameAsValue("[1, {['1']: 1}]"))
  Logger.log("false:"+ sameAsValue("[1, {[a]: 1}]"))
}*/

function array_all(array, pred) {
  for(var i = 0; i < array.length; i++) {
    if(!pred(array[i])) return false;
  }
  return true;
}
// Flatten an array. Ignore undefined
function array_flatten(array) {
  var result = [];
  for(var i = 0; i < array.length; i++) {
    var element = array[i];
    if(!element) continue;
    for(var j = 0; j < element.length; j++) {
      result.push(element[j]);
    }
  }
  return result;
}
function array_repeat(element, number) {
  var result = [];
  while(number > 0) {
    result.push(element);
    number--;
  }
  return result;
}
// Returns true if the expression has the same shape as the value it computes.
function sameAsValue(oldNode) {
  var Syntax = esprima.Syntax;
  if(oldNode == null) return false;
  if(typeof oldNode == "string") {
    return sameAsValue(esprima.parse(oldNode));
  }
  if (oldNode.type == Syntax.Program) {
    var script = oldNode;
    if (script.body.length != 1)
      return false;
    var e = script.body[0];
    if (e.type != Syntax.ExpressionStatement) return false;
    return sameAsValue(e.expression);
  }
  if (oldNode.type == Syntax.Literal) { // Literals can be replaced by clones
    return true;
  }
  if (oldNode.type == Syntax.Identifier) {
    return false;
  }
  if (oldNode.type == Syntax.ArrayExpression) {
    return array_all(oldNode.elements, sameAsValue);
  }
  if (oldNode.type == Syntax.ObjectExpression) {
    return array_all(oldNode.properties, function(p) {
      if(p.type == Syntax.SpreadElement) return false;
      return !p.async && (!p.computed || p.key.type == Syntax.Literal) && p.value && !p.shorthand && !p.method && sameAsValue(p.value)
    });
  }
  return 
}