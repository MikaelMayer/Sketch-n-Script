
//////// Array Manipulation ///////////////

function arrayAll(array, predicate) {
  for(var i in array) {
    if(!predicate(array[i])) return false;
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
function arrayToList_(array)  {
  var list = nil_();
  for(var i = array.length - 1; i >= 0; i--) {
    list = cons_(array[i], list);
  }
  return list;
}

var List = {
  // A foreach which stops if the callback returns true
  foreach: function(list, callback) {
    while(list && list.head) {
      if(callback(list.head)) return;
      list = list.tail;
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
  if(original == value1) return value2;
  if(original == value2) return value1;
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
      return cons_(mergeBinding(updatedEnv1.head, updatedEnv2.head), updatedTail);
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
        expr: env.head.expr,
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

function getEndOffsetInclusiveFormula_(string, endOffsetInclusive) {
  string = sanitizeQuotes_(string);
  var delimiters = [];
  while(string.length > endOffsetInclusive && /[a-zA-Z0-9_$]/.exec(string[endOffsetInclusive])) {
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