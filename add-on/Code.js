/**
 * @OnlyCurrentDoc  Limits the script to only accessing the current document.
 */

function doIt() {
  /*var ts = [];
  ts.push(Date.now());
  var x1 = parser.parse("var x = 1;\n(function(y) { return 1 + y })(x)");
  ts.push(Date.now());
  */
  Logger.log(uneval_(Object.create(a)));
}

// https://developers.google.com/gsuite/add-ons/how-tos/publish-for-domains#before_you_publish
// 

var HIGHLIGHT_VALUE_COLOR = "#B6FFB6";
var UNHIGHLIGHT_VALUE_COLOR = null;
var REVEALED_FORMULA_COLOR = "#FFE8C9";
var REVEALED_FORMULA_NAME = "revealedFormula";
var REVEALED_FORMULA_FONT = "Consolas";
var ERROR_NAME = "definition-error";
var DEFINITION_PARAGRAPHS = "definition-paragraphs"

var RAW = 0; // String interpreted as string
var RAWFORMULA = 1; // String interpreted as a formula
var EQUALFORMULA = 2; // String starting with equal, whose tail is interpreted as a formula

/*
Give names to reuse strings and numbers within your document.

Define them anywhere:
  Write "name = raw text" OR "name = (javascript code)" on a single line.
Use them anywhere, in titles, tables and more:
  Just write "=name"
  Make sure name evaluate to a string
*/

function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addToUi();
}

/**
 * Opens a sidebar in the document containing the add-on's user interface.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 */
function showSidebar() {
  var ui = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('Reversible Formulas');
  DocumentApp.getUi().showSidebar(ui);
}

/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 *
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
  onOpen(e);
}

var FORMULA_VALUE_SEPARATOR = "2AFF312A461BF32A670663193A9D0F61" // md5 of "qdfsmlkfj,mqldskfjmlqksjdfmlkvjqslk"

function builtinEnv_() {
  var assignDefinition = "function assign(o1, o2) {\
    if(typeof o2 != 'object') return o1;\
    if(typeof o1 != 'object') return o2;\
    for(var k in o2) {\
      o1[k] = o2[k];\
    }\
    return o1;\
  }\
  ";
  var h = function(n) {
    return "(function(title, attrs) {\n  "+assignDefinition+"return [\"p\", assign({ heading: \"heading" + n + "\"}, attrs || {}), title]; })";
  }
  var reversibleValue = function(src) {
    return  {v_: eval(src), expr: {sourceType: RAWFORMULA, source: src}};
  }
  return arrayToList_([
    {name: "oui", value: {v_: true, frozen: true}},
    {name: "non", value: {v_: false, frozen: true}},
    {name: "vrai", value: {v_: true, frozen: true}},
    {name: "faux", value: {v_: false, frozen: true}},
    {name: "petit", value: {v_: function(s) { return s.toLowerCase()}, frozen: true }},
    {name: "grand", value: {v_: function(s) { return s.toUpperase()}, frozen: true }},
    {name: "h1", value: reversibleValue(h(1))},
    {name: "h2", value: reversibleValue(h(2))},
    {name: "h3", value: reversibleValue(h(3))},
    {name: "h4", value: reversibleValue(h(4))},
    {name: "h5", value: reversibleValue(h(5))},
    {name: "h6", value: reversibleValue(h(6))},
    {name: "img", value: reversibleValue("(function(src, attrs) {\n "+assignDefinition+"return [\"img\", assign({src: src}, attrs), []] \})")},
    {name: "li", value: reversibleValue("(function(content, attrs) {\n  return [\"li\", attrs || {}, content] \})")},
    {name: "p", value: reversibleValue("(function(content, attrs) {\n  return [\"p\", attrs || {}, content] \})")},
    {name: "table", value: reversibleValue("(function(cells, attrs) {\n  return [\"table\", attrs || {}, cells] \})")},
    {name: "$$", value: reversibleValue("(function(formula, attrs) {\n  "+assignDefinition+"return [\"img\", assign({src: \"http://www.texrendr.com/cgi-bin/mathtex.cgi?\" + encodeURIComponent(formula)}, attrs || {}), []]})")},
    {name: "rotate", value: reversibleValue("(function(array) {\
       var result = [];\
       for(var rIndex in array) {\
         var row = array[rIndex];\
         for(var cIndex in row) {\
           var cell = row[cIndex];\
           if(typeof result[cIndex] == 'undefined') result[cIndex] = [];\
           result[cIndex][rIndex] = cell;\
       } }\
       return result;\
       })")},
    {name: "sum", value: reversibleValue("(function sum(array) {\
       var result = 0;\
       for(var rIndex in array) {\
         var row = array[rIndex];\
         if(typeof row == 'number') result += row;\
         else if(typeof row == 'object') {\
         for(var cIndex in row) {\
           var cell = row[cIndex];\
           if(typeof cell == 'number') result += cell;\
       } } }\
       return result;\
       })")}
    ]);
}


var regexDeclarations = "^[a-zA-Z$_][a-zA-Z0-9_$]*\\s*=\\s+.*$"
var regexExtractDeclaration = "(^|\n)([a-zA-Z0-9_$]+)(\\s*=\\s+)(.*?)\\s*(?:$|(?=\n))";

function parseSidebarCode_(doc, defs) {
  var doc = doc || DocumentApp.getActiveDocument();
  var env = builtinEnv_();
  var r = new RegExp(regexExtractDeclaration, "g");
  r.lastIndex = 0;
  var m = null;
  var lastIndex = 0; // To store the whitespace
  while(m = r.exec(defs)) {
    var newlineBefore = m[1];
    var name = m[2];
    var equalSign = m[3];
    var content = m[4];
    var sourceType = RAW;
    if(content.length > 0 && content[0]=="(" || content[0] =="[") {
      var endInclusiveContent = getEndOffsetInclusiveFormula_(
        defs, m.index + newlineBefore.length + name.length + equalSign.length);
      content = defs.substring(m.index + newlineBefore.length + name.length + equalSign.length,
                               endInclusiveContent + 1);
      content = sanitizeQuotes_(content); 
      sourceType = RAWFORMULA;
    }
    var meta = {
      wsBefore: defs.substring(lastIndex, m.index) + newlineBefore,
      equalSign: equalSign
    }
    env =
      cons_({name: name,
             value:
             computeValue_(doc, 
                           {v_: undefined, // cached
                            vName_: undefined, // Only for inline formulas. The value associated with the name.
                            expr: {
                              name: name,
                              sourceType: sourceType,
                              source: content,
                              range: undefined,
                              namedRange: undefined,
                              meta: meta // Whitespace for unparsing in sidebar
                            },
                            env: env
                           }),
             cache: undefined // environment for call by value in compiled JS
            }, env);
    lastIndex = m.index + newlineBefore.length + name.length + equalSign.length + content.length;
  }
  if(env && env.head && env.head.value && env.head.value.expr && env.head.value.expr.meta) {
    env.head.value.expr.meta.wsAfter = defs.substring(lastIndex);
  }
  return env;
}

// Collect environment variables from the document and body
function collectEnv_(doc, body, env) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  deleteEvalErrors(doc, body);
  
   // Define the search parameters.
  var searchResult = null;
  env = env || builtinEnv_();
  var lastElement = undefined;
  // Search until the paragraph is found.
  // A Javscript formula might span several paragraphs.
  while (searchResult = body.findText(regexDeclarations, searchResult)) {
    var txt = searchResult.getElement();
    if(lastElement && isBeforeElement(txt, lastElement)) continue;
    var s = sanitizeQuotes_(txt.getText());
    regexExtractDeclaration.lastIndex = 0;
    var r = new RegExp(regexExtractDeclaration);
    r.lastIndex = 0;
    var m = r.exec(s);
    if(m) {
      var newline = m[1];
      var name = m[2];
      var equalSign = m[3];
      var content = m[4];
      var textStartIndex = m.index + newline.length + name.length + equalSign.length;
      var dRanges;
      var sourceType;
      if(content.length > 0 && content[0]=="(" || content[0] =="[") {
        sourceType = RAWFORMULA;
        dRanges = getFormulaOnMultipleParagraphs_(txt, textStartIndex);
        content = "";
        for(var d in dRanges) {
          var dr = dRanges[d];
          if(isTextRange(dr)) {
            content = content + (content == "" ? "" : "\n") + dr.txt.getText().substring(dr.start, dr.endInclusive + 1);
          } else {
            content = content + (content == "" ? "" : "\n") + dr.element.editAsText().getText();
          }
        }
        content = sanitizeQuotes_(content);
      } else {
        sourceType = RAW;
        var textEndIndex = textStartIndex + content.length;
        dRanges = [TextRange(txt, textStartIndex, textEndIndex - 1)]
      }
      if(!dRanges) continue; // No end detected
      var lastRange = dRanges[dRanges.length - 1];
      lastElement = isTextRange(lastRange) ? lastRange.txt : lastRange.element;
      // Record this raw text's provenance.
      env =
        cons_({name: name,
               value:
               computeValue_(doc, 
                            {v_: undefined, // cached
                             vName_: undefined, // The value associated with the name (inline formulas only)
                             expr: {
                               name: name,
                               sourceType: sourceType,
                               source: content,
                               range: rangeFromPositions(doc, dRanges),
                               namedRange: undefined,
                               meta: undefined // Whitespace for unparsing in sidebar
                             },
                             env: env
                            }),
               cache: undefined // environment for call by value in compiled JS
              }, env);
    }
  }
  return env;
}

// Returns true if a formula starts with equal
function isEqualFormula_(formula) {
  return formula.length > 0 && formula[0] == "=";
}

// If the expression is a function application, get the function part
function getFunctionSource_(source) {
  var r = new RegExp("^\\(" + commentStart + "(" + varName + ")\\([^\\)]*\\)=" + commentEnd);
  r.lastIndex = 0;
  var x = r.exec(source);
  if(x && source.length > x[0].length && source[x[0].length] == "(") {
    var endInclusive = getEndOffsetInclusiveFormula_(source, x[0].length);
    return source.substring(x[0].length, endInclusive + 1);
  }
  return undefined;
}

// Given a value, if it is not computed yet, compute it
function computeValue_(doc, $$value$$$, $$insertErrors$$$) { // Strange name to prevent override when using with(envJS)
  if(typeof $$insertErrors$$$ === "undefined") $$insertErrors$$$ = true;
  var envJS = buildEnvJS_($$value$$$.env);
  if(typeof $$value$$$.v_ !== "undefined") return $$value$$$;
  try{
    // If the source is a named formula such as (/*name(arg1, argn)=*/(X)(Y))
    // we need to compute two values: X and the result
    // This is what the function evalWithFunctions returns
    var evalWithFunctions = function ($$source$$$) {
      with(envJS) {
        var result = [eval($$source$$$)];
      }
      var fs = getFunctionSource_($$source$$$);
      if(typeof fs !== "undefined") {
        with(envJS) {
          result.push(eval(fs));
        }
      }
      return result;
    }
    if($$value$$$.expr.sourceType == RAW) {
      $$value$$$.v_ = $$value$$$.expr.source;
    } else if($$value$$$.expr.sourceType == RAWFORMULA) {
      var $$x$$$ = evalWithFunctions($$value$$$.expr.source);
      $$value$$$.v_ = $$x$$$[0];
      $$value$$$.vName_ = $$x$$$[1]; // The value for the name, if any
    } else if($$value$$$.expr.sourceType == EQUALFORMULA) {
      if(isEqualFormula_($$value$$$.expr.source)) {
        var $$x$$$ = evalWithFunctions($$value$$$.expr.source.substring(1));
        $$value$$$.v_ = $$x$$$[0];
        $$value$$$.vName_ = $$x$$$[1]; // The value for the name
      } else {
        throw "[Internal error?] Inline formula not starting with equal"
      }
    } else {
      throw ("[Internal error?] not recognized $$value$$$.expr.sourceType: " + $$value$$$.expr.sourceType)
    }
  }
  catch(error) {
    var errormessage = "[Evaluation error: " + error + "] ";
    if($$value$$$.expr.range && $$insertErrors$$$) {
      var positions = drangesOf_($$value$$$.expr.range);
      if(positions.length > 0) {
        var position = positions[positions.length - 1];
        var start = 0;
        var txt;
        if(isTextRange(position)) {
          start = position.endInclusive + 1;
          txt = position.txt;
        } else {
          var element = position.element;
          var parent = element.getParent();
          var indexParent = parent.getChildIndex(element);
          var numChildren = parent.getNumChildren();
          if(indexParent == numChildren - 1) {
            txt = parent.appendText ? parent.appendText(errormessage) : undefined;
          } else {
            txt = parent.insertText ? parent.insertText(indexParent + 1, errormessage) : undefined;
          }
        }
        if(txt) {
          txt.insertText(start, errormessage);
          var endInclusive = start + errormessage.length - 1;
          txt.setForegroundColor(start, endInclusive, "#FF0000");
          addRange_(doc, ERROR_NAME, [TextRange(txt, start, endInclusive)]);
        }
      }
    };
    throw ("Error while computing" + ($$value$$$.expr.name ? " " + $$value$$$.expr.name + " " : "") + "'" +
      $$value$$$.expr.source + "', " + error)
  }
  return $$value$$$;
}

// If the formula sets a name, returns the name
// If the comment is /*name()*/ return nmae
function nameOf_(formula) {
  var nameExtractRegex = new RegExp("^=?\\s*\\("+commentStart+"("+varName+")(?:\\([^\\)]*\\))?="+commentEnd+any+"*\\)$");
  nameExtractRegex.lastIndex = 0;
  var m = nameExtractRegex.exec(formula);
  if(m) {
    return m[1];
  }
  return undefined; // means no value
}

// Returns the new value. Does not modify the environment
function evaluateFormula_(doc, env, formula, txt, start, endInclusive, namedRange, meta) {
  var sourceType = formula.length > 0 && formula[0] == "=" ? EQUALFORMULA : RAWFORMULA;
  var evalValue =
      computeValue_(doc,
                    {v_: undefined,
                     vName_: undefined,
                     expr: {
                       name: nameOf_(formula),
                       sourceType: sourceType,
                       source: formula,
                       range: rangeFromPositions(doc, [TextRange(txt, start, endInclusive)]),
                       namedRange: namedRange,
                       meta: meta
                     },
                     env: env});
  return evalValue;
}

// oldValue and newValue should really be the actual values, not string representations of them
function modifyName(options, docProperties, name, oldValue, newValue) {
  Logger.log("modifyName(" + uneval_(name) + ", " + uneval_(oldValue) + ", " + uneval_(newValue) + ")")
  name = typeof name != "undefined" ? name : "x";
  oldValue = typeof oldValue != "undefined" ? oldValue : "1";
  newValue = typeof newValue != "undefined" ? newValue : "1";
  options = options || defaultOptions;
  options.finalExpr =
     {//name: undefined,
       sourceType: 2, // EQUALFORMULA
       source: "=" + name,
       //range: undefined,
       //namedRange: undefined,
       oldOutput: oldValue,
       newOutput: newValue
       //,meta: undefined
     };
  Logger.log("modifyName(" + uneval_(options) + ", " + uneval_(docProperties) + ")")
  
  return evaluateFormulas(options, docProperties);
}

// Parses the environment and recovers all the definitions that came from the sidebar env
function recoverSidebarEnv_(env) {
  var result = "";
  while(env && env.head) {
    if(env.head.value && env.head.value.expr && env.head.value.expr.meta) {
      var meta = env.head.value.expr.meta;
      result = meta.wsBefore + env.head.value.expr.name + meta.equalSign + env.head.value.expr.source +
        (meta.wsAfter ? meta.wsAfter : "") + result;
    }
    env = env.tail
  }
  return result;
}

function evaluateFormulas(options, docProperties, doc, body) {
  //Logger.log("evaluateFormulas(" + uneval_(options) + ")");
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  options = options || defaultOptions;
  //Logger.log("options: " + uneval_(options));
  docProperties = docProperties || getDocProperties();
  removeNameRangeAndHighlighting_(REVEALED_FORMULA_NAME, doc, body);
  detectFormulaRanges_(doc ,body);
  var sidebarEnv = parseSidebarCode_(doc, docProperties.sidebarEnv);
  var env = collectEnv_(doc, body, sidebarEnv);
  var exprs = extractExprs_(doc, options.finalExpr);
  exprs = resolveDependencies_(exprs, env); // Reorder the exprs so that dependencies are respected.
  var newenvexprs = updateNamedRanges_(doc, env, exprs);
  env = newenvexprs[0];
  exprs = newenvexprs[1];
  var newSidebarEnv = recoverSidebarEnv_(env);
  var nameValues = [];
  var potentialWarnings = newenvexprs[2] || "";
  
  List.foreach(env, function(binding) {
    var v = binding.value.v_; // Already computed
    if(isInserable_(v)) {
      nameValues.unshift([binding.name, uneval_(v), {frozen: binding.value.frozen}]);
    }
  });
  
  var numUpdated = 0;
  
  List.foreach(exprs, function(expr) {
    var formula = expr.source;
    if(!expr.range) return; // It can happen if ghost expressions for update are added.
    var positions = drangesOf_(expr.range);
    var oldOutput = expr.oldOutput; // Undefined if the formula is not yet computed
    var newOutput = expr.newOutput; // The value if modified by the user. Should have been handled in updateNamedRanges_
    var evalValue =
        computeValue_(doc,
                      {v_: undefined, // Usually the raw value
                       vName_: undefined, // Can be a function
                       expr: expr,
                       env: env}, !options.firstlaunch);
    if(evalValue) {
      if(evalValue.expr.name) {
        env = cons_({name: evalValue.expr.name, value: evalValue}, env);
      }
      var v = evalValue.v_;
      var strV = uneval_(v);
      var vName = typeof evalValue.vName_ != "undefined" ? evalValue.vName_ : v; 
      if(isInserable_(vName) && evalValue.expr.name) {
        nameValues.push([evalValue.expr.name, strV]);
      }
      var valueWasUpdated = strV != uneval_(oldOutput);
      if(isUnderSelections_(doc, positions)) {
        var insertedPositions;
        if(!options.firstlaunch && valueWasUpdated) {
          numUpdated += 1;
          // If positions are ranges, it will delete everything inside first
          insertedPositions = insertRichValue_(doc, positions, v, expr, exprs);
          var formulaValueName = formulaValue_(formula, strV);
          expr.namedRange = addRange_(doc, formulaValueName, insertedPositions);
          expr.range = expr.namedRange.getRange();
        } else {
          insertedPositions = drangesOf_(expr.range);
        }
        if(!options.firstlaunch && insertedPositions) {
          if(options.highlightValues == "true") {
            colorize_(insertedPositions, HIGHLIGHT_VALUE_COLOR);
          } else if(!valueWasUpdated) {
            colorize_(insertedPositions, UNHIGHLIGHT_VALUE_COLOR);
          }
        }
      }
    }
  });
  maybeSaveNewSidebarEnv(newSidebarEnv, docProperties.sidebarEnv);
  return {
    nameValues: nameValues,
    feedback: "Updated " + numUpdated + " computed values." + potentialWarnings,
    newSidebarEnv: newSidebarEnv};
}

// Remove the formulas that touch the given range.
function removeFormulas_(doc, range) {
  var namedFormulas = getFormulas_(doc);
  foreachDRange_(
    range,
    function(txt, start, endInclusive) {
      foreachNamedRange_(
        namedFormulas,
        function(name /* Maybe to expand */, range, namedRange) {
          var shouldDelete = false;
          foreachDRange_(
            range,
            function(txtF, startF, endInclusiveF) {
              if(areSameElement_(txt, txtF) && !(endInclusive < startF || endInclusiveF < start)) {
                shouldDelete = true;
                return true;
              }
            },
            function(elementF) {
              
            });
          if(shouldDelete) {
            namedRange.remove();
          }
        })
    },
    function(element) {
      foreachNamedRange_(
        namedFormulas,
        function(name /* Maybe to expand */, range, namedRange) {
          var shouldDelete = false;
          foreachDRange_(
            range,
            function(txtF, startF, endInclusiveF) {
              if(isDescendantOf_(txtF, element)) {
                shouldDelete = true;
                return true;
              }
            },
            function(elementF) {
              if(isDescendantOf_(elementF, element)) {
                shouldDelete = true;
                return true;
              }
            });
          if(shouldDelete) {
            namedRange.remove();
          }
        })
    });
}

// Finds all formula ranges and add a namedrange for them, no matter the selection
// If there were already named ranges, order the ranges.
function detectFormulaRanges_(doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var searchResult = null;
  var namedRanges = getFormulas_(doc);
  var namesFound = [];
  foreachNamedRange_(namedRanges,
                     function(name) {
                       namesFound[name] = true;
                     }, function() {});
  garbageCollectLongNames(namesFound, "=");
  
  var isPartiallyGenerated = function(txt, start, endInclusive) {
    var overlapsComputedFormulas = false;
    foreachNamedRange_(
      namedRanges,
      function(name /*Maybe to expand*/, range, namedRange) {
        return foreachDRange_(
          range,
          function(txtGenerated, startGenerated, endInclusiveGenerated) {
            if(areSameElement_(txt, txtGenerated) && !(endInclusive < startGenerated || endInclusiveGenerated < start)) {
              // Now we check if the formula was evaluated: If not, we remove the previous formula and we're ok.
              var formulaValue = formulaValueUnapply_(maybeExpandLongName(name));
              if(typeof formulaValue[1] == "undefined") {
                namedRange.remove();
                return true; // To stop that
              } else {
                overlapsComputedFormulas = true; // This is generated text, we shall ignore it to detect formulas
              }
            }
          },
          function(element) { // Nothing to do here.
          });
      });
    return overlapsComputedFormulas;
  }
  
  var needToReorder = false; 
  // Search until a formula is found.
  while (searchResult = body.findText("=([a-zA-Z_$]|\\(|\\[)", searchResult)) {
    var txt = searchResult.getElement().asText();
    var start = searchResult.getStartOffset();
    var endInclusive = getEndOffsetInclusiveFormula_(txt.getText(), start + 1);
    if(endInclusive == -1) continue;
    var fullmatch = sanitizeQuotes_(txt.getText().substring(start, endInclusive + 1));
    if(!isPartiallyGenerated(txt, start, endInclusive)) {
      //Logger.log("Marking " + txt.getText().substring(start, endInclusive + 1) + " as a formula");
      if(!needToReorder) {
        foreachNamedRange_(
          namedRanges,
          function(name /* Maybe to expand */, range, namedRange) {
            return foreachDRange_(
              range,
              function(txtGenerated, startGenerated, endInclusiveGenerated) {
                if(isBeforeElement(txt, txtGenerated) || // Newly detected formula is before an already existing one
                   areSameElement_(txt, txtGenerated) && endInclusive < endInclusiveGenerated) {
                  needToReorder = true;
                  return true;
                }
              },
              function(elementGenerated) {
                if(isBeforeElement(txt, elementGenerated)) {
                  needToReorder = true;
                  return true;
                }
              });
          });
      }
      addRange_(doc, fullmatch, [TextRange(txt, start, endInclusive)]);
    }
  }
  
  if(needToReorder) {
    reorderFormulaRanges_(doc, body);
  }
}

// Careful not to modify 
function foreachNamedRange_(namedRanges, callbackNameRange) {
  for(var i in namedRanges) {
    var namedRange = namedRanges[i];
    var nameMaybeToExpand = namedRange.getName();
    var range = namedRange.getRange();
    var x = callbackNameRange(nameMaybeToExpand, range, namedRange);
    if(x) return x;
  }
}

// Takes all the formulas in the document and put them in the order of the document
function reorderFormulaRanges_(doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var searchResult = null;
  var namedRanges = getFormulas_(doc);
  var toSort = [];
  var toAdd = true;
  foreachNamedRange_(
    namedRanges,
    function(name /* Maybe to expand */, range, namedRange) {
      foreachDRange_(
        range,
        function(txt, start, endInclusive, rangeElement) {
          if(toAdd) {
            toSort.push([name, range, getPathUntilBody_(txt), start]);
            toAdd = false;
          }
        },
        function(element, rangeElement) {
          if(toAdd) {
            toSort.push([name, range, getPathUntilBody_(element)]);
            toAdd = false;
          }
        });
      namedRange.remove();
      toAdd = true;
    });
  toSort.sort(sortingFunction);
  for(var i in toSort) {
    var x = toSort[i];
    var fullname = x[0];
    var range = x[1];
    doc.addNamedRange(fullname, range);
  }
}

// Sorts arrays which contain ranges in third position, and possibly a text index at fourth position
function sortingFunction(e1, e2) {
  var c = comparePaths(e1[2], e2[2]);
  if(c != 0) return c;
  if(e1.length == 4 && e2.length == 4)
    return e1[3] - e2[3];
  else
    return 0;
}

/* Only in case something goes wrong ! All formulas would be lost
function removeNamedRanges(doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var ranges = doc.getNamedRanges();
  for(var i in ranges) {
    ranges[i].remove();
  }
}
*/

function removeNamedRanges_(doc, body, name) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var ranges = doc.getNamedRanges(name);
  for(var i in ranges) {
    ranges[i].remove();
  }
}

function deleteEvalErrors(doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var ranges = doc.getNamedRanges(ERROR_NAME);
  for(var i in ranges) {
    var namedRange = ranges[i];
    var ranges = namedRange.getRange().getRangeElements();
    for(var j in ranges) {
      var range = ranges[j];
      //Logger.log("Deleting from " + range.getStartOffset() + " to " + range.getEndOffsetInclusive());
      range.getElement().deleteText(range.getStartOffset(), range.getEndOffsetInclusive());
    }
    namedRange.remove();
  }
}

// For debugging purposes only
/*
function displayNamedRanges(doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var ranges = doc.getNamedRanges();
  for(var i in ranges) {
    var name = ranges[i].getName();
    if(/^=/.exec(name)) {
      Logger.log(name + ":" + ranges[i].getId());
    }
  }
}
*/

// Returns the list of formulas inside the given doc.
function getFormulas_(doc) {
  var namedRanges = doc.getNamedRanges();
  var result = [];
  for(var i in namedRanges) {
    var namedRange = namedRanges[i]
    var name = namedRange.getName();
    if(/^=/.exec(name)) {
      result.push(namedRange);
    }
  }
  return result;
}

function formulaValue_(formula, value) {
  return formula + FORMULA_VALUE_SEPARATOR + value;
}

function formulaValueUnapply_(formulaValue) {
  if(formulaValue.indexOf(FORMULA_VALUE_SEPARATOR) == -1) {
    return [formulaValue, undefined];
  } else {
    return formulaValue.split(FORMULA_VALUE_SEPARATOR)
  }
}

function formulaOf_(letExp) {
  if(letExp.sourceType == EQUALFORMULA && letExp.source.length > 0)
    return letExp.source.substring(1);
  if(letExp.sourceType == RAW)
    return toExpString(letExp.source);
  if(letExp.sourceType == RAWFORMULA)
    return letExp.source;
  throw ("[Internal error?] Empty formula that should start with equal: " + letExp);
}

function newFormulaOf_(letExp, newFormula) {
  if(letExp.sourceType == EQUALFORMULA)
    return "=" + newFormula;
  if(letExp.sourceType == RAW || letExp.sourceType == RAWFORMULA) {
    if(new RegExp("^\\s*" + stringRegex + "\\s*$").exec(newFormula))
      return eval(newFormula);
    else if(/^\s*[\(\[]/.exec(newFormula))
      return newFormula
    else
      return "(" + newFormula + ")";
  }
  throw ("[Internal error?] What kind of source type is it? " + letExp.sourceType);
}


// Update a list of let expressions with either a name or no name.
// If a formula is modified, we mark it so that we can replace them at the end.
// Modifies the document in place and returns the new env.
// Returns {ctor: "Ok", [new env, new formula ranges]} or {ctor: "Err", string message}
function updateLetExprs_(doc, env, letExprs) {
  if(!letExprs) {
    return Ok([env, letExprs]);
  }
  var letExp = letExprs.head;
  var sourceType = letExp.sourceType;
  var formula = formulaOf_(letExp);
  var oldOutput = letExp.oldOutput;
  var newOutput = letExp.newOutput;
  var evalValue =
      computeValue_(doc,
                    {v_: undefined,
                     expr: letExp,
                     env: env});
  if(!evalValue) return Err("Could not evaluate " + formula);
  var newEnv = evalValue.expr.name ? cons_({name: evalValue.expr.name, value: evalValue}, env) : env;
  return resultCase(
    updateLetExprs_(doc, newEnv, letExprs.tail), Err,
    function(updatedNewEnvUpdatedLetExprsTail) {
      var updatedNewEnv = updatedNewEnvUpdatedLetExprsTail[0];
      var updatedLetExprsTail = updatedNewEnvUpdatedLetExprsTail[1];
      var finish = function(updatedEnv1, updatedEnv2, updatedFormula) {
        return resultCase(
          mergeUpdatedEnvs(updatedEnv1, updatedEnv2), Err,
          function(updatedEnv) {
            var updatedLetExprs =
                cons_(
                  {name: letExp.name,
                   source: newFormulaOf_(letExp, updatedFormula),
                   sourceType: letExp.sourceType,
                   oldOutput: undefined,
                   newOutput: updatedFormula,
                   range: letExp.range,
                   namedRange: letExp.namedRange,
                   diffs: updatedFormula != formula,
                   meta: letExp.meta
                  }, updatedLetExprsTail);
            return Ok([updatedEnv, updatedLetExprs]);
          });
      }
      var oldOutput = letExp.oldOutput;
      var newOutput = letExp.newOutput;
      var updatedEnv1 = updatedNewEnv;
      var formulaEnvUpdate = Ok({env: env, node: formula});
      if(evalValue.expr.name) { // Then this formula introduced a variable, we might need to update it.
        newOutput = mergeValues(oldOutput, updatedNewEnv.head.value.v_, newOutput);
        updatedEnv1 = updatedNewEnv.tail;
      }
      if(typeof evalValue.expr.oldOutput !== "undefined" &&
         areDifferentValues_(oldOutput, newOutput)) {
        // Here the value was changed directly or indiretly, or a merge of both.
        formulaEnvUpdate = update_(env, formula)(newOutput);
        Logger.log("After formula update")
        Logger.log(uneval_(env.head.value.v_))
      }
      return resultCase(
        formulaEnvUpdate, Err,
        function(updatedEnv2updatedFormula) {
          var updatedEnv2 = updatedEnv2updatedFormula.env;
          var updatedFormula = updatedEnv2updatedFormula.node;
          return finish(updatedEnv1, updatedEnv2, updatedFormula);
        });
    });
}

function elementToValue(element) {
  if(element.getType() == DocumentApp.ElementType.TABLE) {
    var nRows = element.getNumRows();
    var table = [];
    for(var rowIndex = 0; rowIndex < nRows; rowIndex++) {
      var row = element.getRow(rowIndex)
      var nCells = row.getNumCells();
      var tableRow = [];
      for(var cellIndex = 0; cellIndex < nCells; cellIndex++) {
        var cell = row.getCell(cellIndex);
        var cellNumChildren = cell.getNumChildren();
        var subElems = [];
        for(var childIndex = 0; childIndex < cellNumChildren; childIndex++) {
          subElems.push(elementToValue(cell.getChild(childIndex)));
        }
        tableRow.push(subElems);
      }
      table.push(tableRow);
    }
    return ["table", {}, table];
  } else if(element.getType() == DocumentApp.ElementType.PARAGRAPH ||
            element.getType() == DocumentApp.ElementType.LIST_ITEM) {
    var numChildren = element.getNumChildren();
    var subElems = [];
    for(var childIndex = 0; childIndex < numChildren; childIndex++) {
      subElems.push(elementToValue(element.getChild(childIndex)));
    }
    return [element.getType() == DocumentApp.ElementType.PARAGRAPH ? "p" : "li", {}, subElems];
  } else if(element.getType() == DocumentApp.ElementType.TEXT) {
    return toRichTextFormula(element, 0, element.getText().length - 1);
  } else if(element.getType() == DocumentApp.ElementType.INLINE_IMAGE) {
    return ["img", {}, []]; // Will be asjusted later with the old value.
  } else {
    throw "Element cannot be converted to a computable value:" + element;
  }
}

// Returns the list of expressions from the program
// Order them by free variable dependency
// Returns Array [{name?, sourceType, source (formula), range:{txt, start, endInclusive, oldOutput, newOutput}]
// oldOutput is undefined and newOutput == formula if the formula is not computed.
function extractExprs_(doc, maybeFinalExpr) {
  var namedRanges = getFormulas_(doc);
  
  var exprs = [];
  for(var i in namedRanges) {
    var namedRange = namedRanges[i]
    var formulaValue = formulaValueUnapply_(getNamedRangeLongName(namedRange));
    var formula = formulaValue[0];
    var oldOutputStr = formulaValue[1];
    var oldOutput = oldOutputStr; // compatibility with previous approach where strings were stored raw.
    try {
      oldOutput = eval(oldOutputStr); //Now values are stored in expression format.
    } catch(error) { 
      // Here it's fine
    }
    var range = namedRange.getRange();
    var newOutput = "";
    var numOfElements = 0;
    function addToOutput(newValue) {
      if(numOfElements == 1 && !Array.isArray(newOutput) || (!isRichText_(newOutput) && !isElement_(newOutput))) {
        newOutput = [newOutput]; // Force a list of elements.
      }
      if(numOfElements >= 1) {
        newOutput.push(newValue);
      } else {
        newOutput = newValue;
      }
      numOfElements++;
    }
    
    foreachDRange_(
      range,
      function(txt, start, endInclusive) {
        addToOutput(toRichTextFormula(txt, start, endInclusive));
      },
      function(element) {
        addToOutput(elementToValue(element));
      });
    newOutput = reconcileAsMuchAsPossible_(newOutput, oldOutput);
    exprs.push( // Insert at the end. We might consider permuting the array to resolve dependencies later.
      {name: nameOf_(formula),
       sourceType: isEqualFormula_(formula) ? EQUALFORMULA : RAWFORMULA,
       source: formula,
       range: range,
       namedRange: namedRange,
       oldOutput: oldOutput,
       newOutput: newOutput,
       meta: undefined});
  }
  if(maybeFinalExpr) {
    exprs.push(maybeFinalExpr);
  }
  return arrayToList_(exprs);
}


function freeVarsOf_(formula) {
  return jsFormulaCase(formula, {
    whitespaces: function(wsBefore, content, wsAfter) {
        return freeVarsOf_(content);
      },
    parentheses: function(content) {
        return freeVarsOf_(content);
      },
    string: function(stringValue) {
        return [];
      },
    number: function(numberValue) {
        return [];
      },
    boolean: function(boolean) {
        return [];
      },
    variable: function(name) {
        if(name == "if" || name == "function" || name == "var" || name == "const" || name == "let" || name == "else"
           || name == "return"|| name == "throw" || name == "catch") return [];
        return [name]
      },
    operator: function(left, ws, op, right) {
        return freeVarsOf_(left).concat(freeVarsOf_(right));
      },
    orElse: function(formula) { // Assumes no free variables.
        return [];
      }
  })
}

// Try to find an ordering of exprs so that all free variables can be satisfied.
// O(n²)
function resolveDependencies_(exprs, env) {
  var result = [];
  var toInsert = []; // Array of [expr, freeVars]
  var definedVars = {};
  List.foreach(env, function(binding) {
    definedVars[binding.name] = true;
  });
  var tmp = exprs;
  var isReady = function(expr) {
    return arrayAll(freeVarsOf_(formulaOf_(expr)), function(name) { return definedVars[name] });
  }
  var toInsertSize = -1;
  while(tmp && tmp.head) {
    var expr = tmp.head;
    if(isReady(expr)) {
      result.push(expr);
      if(expr.name) {
        definedVars[expr.name] = true;
      }
    } else {
      toInsert.push(expr);
    }
    tmp = tmp.tail
    if(!tmp && toInsert.length > 0) {
      if(toInsertSize > 0 && toInsert.length >= toInsertSize) { // no progress, there is a circular dependency. We stop.
        for(var i = 0; i < toInsert.length; i++) {
          result.push(toInsert[i]);
        }
        break;
        //throw ("Unresolved dependencies in " +
        //   toInsert.map(function(expr) { return expr.source}).join(","));
      }
      toInsertSize = toInsert.length; // Must decrease strictly next time.
      tmp = arrayToList_(toInsert);
      toInsert = [];
    }
  }
  return arrayToList_(result);
}

// We update env that have changed in the output first.
// Modifies the document and return the new env
// Returns [new env, new formula ranges]
function updateNamedRanges_(doc, env, exprs) {
  var changed = false;
  List.foreach(exprs, function(expr) {
    var to = typeof expr.newOutput
    if(typeof expr.oldOutput !== "undefined" &&
       areDifferentValues_(expr.oldOutput, expr.newOutput)) {
      changed = (expr.name || expr.source) + " changed to " + uneval_(expr.newOutput);
      return changed;
    }
  });
  if(changed) {
    Logger.log("Value of " + changed + ". Back-propagating");
    return resultCase(
      updateLetExprs_(doc, env, exprs), function (msg) { 
        return [env, exprs, msg]; },
      function(newenvexprs) {
        var newenv = newenvexprs[0];
        var tmp = newenv;
        while(tmp && tmp.diffs) {
          if(tmp.head.diffs) {
            var newValue = tmp.head.value.v_;
            var formula = formulaOf_(tmp.head.value.expr);
            resultCase(
              update_(tmp.tail, formula)(newValue), function (msg) { throw msg; },
              function(newtmptailformula) {
                var newtmptail = newtmptailformula.env;
                var newFormula = newtmptailformula.node;
                Logger.log(formula)
                Logger.log("<--")
                Logger.log(uneval_(newValue))
                Logger.log("===")
                Logger.log(newFormula)
                var newSource = newFormulaOf_(tmp.head.value.expr, newFormula);
                if(newSource != tmp.head.value.expr.source) {
                  var range = tmp.head.value.expr.range;
                  if(range) {
                    var positions = drangesOf_(range);
                    if(positions.length == 1 && isTextRange(positions[0])) {
                      var txt = positions[0].txt;
                      var start = positions[0].start;
                      var endInclusive = positions[0].endInclusive;
                      txt.deleteText(start, endInclusive);
                      txt.insertText(start, newSource);
                    }
                  } else if(tmp.head.value.expr.meta) { // sidebarEnv
                    tmp.head.value.expr.source = newSource;
                  }
                }
                resultCase(
                  mergeUpdatedEnvs(newtmptail, tmp.tail), function (msg) { throw msg; },
                  function(newTmpTail) {
                    tmp.tail = newTmpTail;
                  });
              });
          }
          tmp = tmp.tail;
        }
        
        // TODO: (not needed if all formulas are evaluated)
        //       Update formulasRange that were modified in the document (set the update formula)
        return newenvexprs; })
  } else {
    return [env, exprs];
  }
}

// Returns true for strings and objects representing strings
function isInserable_(v) {
  return typeof v == "string" || typeof v == "number" || typeof v == "boolean" ||
         typeof v == "object" && v.length == 2 && (typeof v[0] == "string" || typeof v[0] == "number" || typeof v[0] == "boolean") && typeof v[1] == "object";
}

// Splits an element an the given insertion position
// Returns
function splitAt_(insertPosition) {
  
}

// Inserts a rich element at the given index by invoking parent["append" + name] or parent["insert" + name],
// depending on the context.
// Body-level elements (i.e.. list items, tables and paragraphs) can be inserted only if the formula takes an entire paragraph.
// insertPosition is either {ctor: "IndexPosition", parent: Element, index: Int} or {ctor: "TextPosition", txt: TextElement, start: Int}
function insertElementAt_(doc, insertPosition, name, initializationContent, exprs) {
  // TODO: If the append[name] or insert[name] method is not available in the parent (the paragraph)
  // the value should be inserted in the parent of the parent (the body, the table cell, or whatever)
  // splitting the paragraph if needed.
  if(insertPosition.ctor == "IndexPosition") { // it's inside the list of a parent
    var parent = insertPosition.parent;
    var indexInsertion = insertPosition.index;
    var numChildren = parent.getNumChildren();
    var txtLastChild = indexTxt == numChildren - 1;
    if(indexInsertion >= numChildren) { // Last element
      if(typeof parent["append" + name] != "undefined") {
        return parent["append" + name](initializationContent);
      }
      throw ("Cannot append " + name + " here");
    } else {
      if(typeof parent["insert" + name] != "undefined") {
        return parent["insert" + name](indexInsertion, initializationContent);
      }
      throw ("Cannot insert " + name + " here");
    }
  }
  // It's inside a text. We might have to split the text.
  var txt = insertPosition.txt;
  var index = insertPosition.start;
  var parent = txt.getParent();
  var indexTxt = parent.getChildIndex(txt);
  var numChildren = parent.getNumChildren();
  var txtLastChild = indexTxt == parent.getNumChildren() - 1;
  if(txt.getText().length == index) { // No need to split. Insert after the text element!
    if(txtLastChild) { // Last element
      if(typeof parent["append" + name] != "undefined") {
        return parent["append" + name](initializationContent);
      }
      throw ("Cannot append " + name + " here"); 
    } else {
      if(typeof parent["insert" + name] != "undefined") {
        return parent["insert" + name](indexTxt + 1, initializationContent);
      }
      throw ("Cannot insert " + name + " here");
    }
  }
  if(index == 0) { // No need to split. Insert before the text
    if(typeof parent["insert" + name] != "undefined") {
      return parent["insert" + name](indexTxt, initializationContent);
    }
    throw ("Cannot insert " + name + " here");
  }
  // Need to split here, possibly removing empty remaining text element
  // Attempt to reposition namedRanges from exprs on the deleted text.
  var toReposition = [];
  var shouldRemove = false;
  var currentRange = [];
  List.foreach(
    exprs,
    function(expr) {
      var range = expr.range;
      var namedRange = expr.namedRange;
      if(!range || !namedRange) return;
      var positions = drangesOf_(range);
      var toReAdd = [];
      positions = positions.filter(function(position) {
        if(isTextRange(position)) {
          var txtF = position.txt;
          var startF = position.start;
          var endInclusiveF = position.endInclusive;
          if(areSameElement_(txtF, txt) && endInclusiveF >= index) {
            toReAdd.push([startF - index, endInclusiveF - index]);
            return false;
          }
          return true;
        } else {
          return true;
        }
      });
      if(toReAdd.length > 0) {
        toReposition.push([expr, namedRange.getName() /* Might be expandable but we don't care here */, toReAdd, positions]);
        namedRange.remove();
      }
    });
  var txtToReinsert = txt.getText().substring(index);
  txt.deleteText(index, txt.getText().length - 1); // Deletes all the associated namedRanges
  if(txtLastChild) { // Last element
    var elementToReturn = parent["append" + name](initializationContent);
    var txt2 = parent.appendText(txtToReinsert);
  } else {
    var elementToReturn = parent["insert" + name](indexTxt + 1, initializationContent);
    var txt2 = parent.insertText(indexTxt + 2, txtToReinsert);
  }
  for(var i in toReposition) {
    var x = toReposition[i];
    var expr = x[0];
    var name = x[1];
    var toReAdd = x[2];
    var positions = x[3];
    for(var k in toReAdd) {
      var startEnd = toReAdd[k];
      positions.unshift(TextRange(txt2, startEnd[0], startEnd[1]));
    }
    var newNamedRange = addRange_(doc, name, positions);
    expr.namedRange = newNamedRange;
    expr.range = newNamedRange.getRange();
  }
  var nf = getFormulas_(doc);
  return elementToReturn;
}

function valuestoArray_(values) {
  if(isElement_(values) ||
     typeof values == "string" ||
     typeof values == "number" ||
     typeof values == "boolean" ||
     isRichText_(values)) { // Not text, it's an element
    values = [values] // We wrap it in a list
  } else if(Array.isArray(values)) {
    // That's fine, it's an array. Hopefully recursively it's good.
  } else {
    Logger.log("Unexpected value: " + uneval_(values));
    values = [values]
  }
  return values;
}

/* type alias ToInsert =
      {ctor: "element", tag: "InlineImage" | "Paragraph" | "Table" | ..., attrs: Object, children: Array ToInsert}
      | {ctor: "element
*/
// Converts the values into elements that can be inserted
// Pre-fetches all images
function valuesToElementsToInsert_(values) {
  // Make sure values is an array
  values = valuestoArray_(values);
  // We gather the elements to insert
  var toInsert = [];
  // We gather the elements to insert
  for(var v in values) {
    var value = values[v];
    if(isElement_(value)) {
      var tag = value[0];
      var attrs = value[1];
      var children = value[2];
      if(tag.toLowerCase() == "img" || tag.toLowerCase() == "image") { // Later: should work for anything that can be inserted or appended
        var url = attrs.src;
        if(!url) throw "['img', {src: 'URL'}, []] is the valid syntax. Missing src attribute";
        var blob = UrlFetchApp.fetch(url).getBlob();
        toInsert.push({ctor: "element", tag: "InlineImage", content: blob, attrs: attrs, children: []});
      } else if(tag.toLowerCase() == "paragraph" || tag.toLowerCase() == "p") {
        toInsert.push({ctor: "element", tag: "Paragraph", content: "", attrs: attrs, children: valuesToElementsToInsert_(children)});
      } else if(tag.toLowerCase() == "listitem" || tag.toLowerCase() == "li") {
        toInsert.push({ctor: "element", tag: "ListItem", content: "", attrs: attrs, children: valuesToElementsToInsert_(children)});
      } else if(tag.toLowerCase() == "table") {
        var initContent = [];
        var childrenToInsert = [];
        children = valuestoArray_(children);
        for(var rowIndex in children) {
          var childRow = [];
          var childToInsertRow = [];
          var row = valuestoArray_(children[rowIndex]); // Make sure it's an array
          for(var colIndex in row) {
            childRow.push("");
            childToInsertRow.push(valuesToElementsToInsert_(row[colIndex]));
          }
          initContent.push(childRow);
          childrenToInsert.push(childToInsertRow);
        }
        toInsert.push({ctor: "element", tag: "Table", content: initContent, attrs: attrs, children: childrenToInsert});
        // TODO Google docs cannot end with a table, a paragraph would be appended in this case. Check this.
      } else {
        throw ("Tag cannot be inserted (yet?): " + tag);
      }
    } else {
      if(isRichText_(value)) {
        toInsert.push({ctor: "text", content: value[0], attrs: value[1]});
      } else if(typeof value == "number" || typeof value == "boolean") {
        toInsert.push({ctor: "text", content: "" + value});
      } else if(typeof value == "function") { // We should render the body of the function?
        toInsert.push({ctor: "text", content: "<function>"});
      } else if(typeof value == "string") {
        toInsert.push({ctor: "text", content: value});
      } else {
        toInsert.push({ctor: "text", content: uneval_(value)});// This is unsafe ?!
      }
    }
  } // for loop
  return toInsert;
}

function convertSpecialValue_(setMethod, value) {
  if(setMethod == "setGlyphType") {
    value = value.toUpperCase && value.toUpperCase();
    if(typeof DocumentApp.GlyphType[value] != "undefined") {
      value = DocumentApp.GlyphType[value];
    } else {
      value = DocumentApp.GlyphType.BULLET;
    }
  } else if(setMethod == "setHeading") {
    value = value.toUpperCase && value.toUpperCase();
    if(typeof DocumentApp.ParagraphHeading[value] != "undefined") {
      value = DocumentApp.ParagraphHeading[value];
    } else {
      value = DocumentApp.ParagraphHeading.NORMAL;
    }
  } else if(setMethod == "setTextAlignment") {
    value = value.toUpperCase && value.toUpperCase();
    if(typeof DocumentApp.TextAlignment[value] != "undefined") {
      value = DocumentApp.TextAlignment[value];
    } else {
      value = DocumentApp.TextAlignment.NOrMAL;
    }
  } else if(setMethod == "setAlignment") {
    value = value.toUpperCase && value.toUpperCase();
    if(typeof DocumentApp.HorizontalAlignment[value] != "undefined") {
      value = DocumentApp.HorizontalAlignment[value];
    } else {
      value = DocumentApp.HorizontalAlignment.LEFT;
    }
  }
  return value;
}


function standardizeKey_(key) {
  if(key == "link" || key == "url") return "linkUrl";
  if(key == "alt" || key == "desc") return "altDescription";
  if(key == "id") return "listId";
  if(key == "title") return "setAltTitle";
  if(key == "color") return "foregroundColor";
  if(key == "background") return "backgroundColor";
  if(key == "strike") return "strikethrough";
  if(key == "align") return "textAlignment";
  if(key == "horizontal") return "alignment";
  if(key == "nesting") return "nestingLevel";
  if(key == "glyph") return "glyphType";
  return key;
}

function isInlineElement_(toInsert) {
  return toInsert.ctor == "text" || toInsert.ctor == "element" && toInsert.tag == "InlineImage";
  // TODO: Other inline elements, such as page break, etc?
}

function maybeWrapInParagraph_(toInsert) {
  var allInline = true;
  for(var i in toInsert) {
    var t = toInsert[i];
    allInline = allInline && isInlineElement_(t);
  }
  if(allInline) {
    return [{ctor: "element", tag: "Paragraph", content: "", attrs: {}, children: toInsert}]
  }
  return toInsert;
}

// Insert the list of elements to insert at the given position
// exprs is given in case we need to move namedRanges when splitting some text.
function insertAtPosition_(doc, insertPosition, toInsert, exprs) {
  var insertedElements = [];
  var attrsToSet = [];
  
  var listItems = {};

  // We set text attributes later to avoid formatted text to spill non-formatted text
  for(var i in toInsert) {
    if(toInsert[i].ctor == "element") {
      var blob = toInsert[i].content;
      var attrs = toInsert[i].attrs;
      var tag = toInsert[i].tag;
      var children = toInsert[i].children;
      var element = insertElementAt_(doc, insertPosition, tag, blob, exprs);
      for(var key in attrs) {
        var value = attrs[key];
        key = standardizeKey_(key);
        var setMethod = key.length > 0 && ("set" + key[0].toUpperCase() + key.substring(1));
        if(!setMethod) continue;
        value = convertSpecialValue_(setMethod, value);
        if(setMethod == "setListId" && tag == "ListItem") { // We need to get the ID of previously inserted elements.
          if(typeof listItems[value] != "undefined") {
            element.setListId(listItems[value]);
          } else {
            listItems[value] = element;
          }
        } else {
          if(key != "attributes" && 
             key.length > 0 && element[setMethod]) {
            element[setMethod](value);
          }
        }
      }
      insertedElements.push(Element(element));
      
      if(tag == "Table") {
        // Append all children, remove the first text of each cell.
        for(var rowIndex = 0; rowIndex < children.length; rowIndex++) {
          var row = children[rowIndex];
          for(var cellIndex = 0; cellIndex < row.length; cellIndex++) {
            var tableCell = element.getCell(rowIndex, cellIndex);
            var childInsertPosition = { ctor: "IndexPosition", parent: tableCell, index: 0 };
            insertAtPosition_(doc, childInsertPosition, maybeWrapInParagraph_(row[cellIndex]), exprs); // We don't need the inserted elements there
            if(tableCell.getNumChildren() >= 2) { // The last paragraph was a dummy one, we remove it.
              // TODO: Unless the element before is itself a table.
              var lastChild = tableCell.getChild(tableCell.getNumChildren() - 1);
              var remainingElem = lastChild.getPreviousSibling();
              if(remainingElem.getType() != DocumentApp.ElementType.TABLE) {
                lastChild.removeFromParent();
              }
            }
          }
        }
      } else if(tag == "Paragraph" || tag == "ListItem") {
        var childInsertPosition = { ctor: "IndexPosition", parent: element, index: 0 };
        insertAtPosition_(doc, childInsertPosition, children); // We don't need the inserted elements there
      }
      insertPosition = {ctor: "IndexPosition", parent: element.getParent(), index: element.getParent().getChildIndex(element) + 1};
    } else if(toInsert[i].ctor == "text") {
      var content = toInsert[i].content;
      var attrs = toInsert[i].attrs;
      var txt, start;
      if(insertPosition.ctor == "TextPosition") {
        // At this point, we should suppose that we insert text and that the insertPosition is [txt, start]
        txt = insertPosition.txt;
        start = insertPosition.start;
        txt.insertText(start, content);
        // Update insert position
        insertPosition = {ctor: "TextPosition", txt: txt, start: start + content.length};
      } else {
        // Here we need to insert a text element
        var parent = insertPosition.parent;
        var index = insertPosition.index;
        var numChildren = insertPosition[2];
        start = 0;
        if(content != "") {
          if(index + 1 == parent.getNumChildren()) {
            txt = parent.appendText(content); // We should check if we can insert to the previous text.
          } else {
            txt = parent.insertText(index, content);
          }
          insertPosition = {ctor: "TextPosition", txt: txt, start: content.length};
        }
      }
      var endAfterReplacement = start + content.length - 1;
      if(attrs && txt) {
        attrsToSet.push({txt: txt, start: start, endAfterReplacement: endAfterReplacement, attrs: attrs});
      }
      if(txt) {
        insertedElements.push(TextRange(txt, start, endAfterReplacement));
      }
    }
  }
  // Now we set the attributes
  for(var a in attrsToSet) {
    var attrToSet = attrsToSet[a];
    var txt = attrToSet.txt;
    var start = attrToSet.start;
    var endAfterReplacement = attrToSet.endAfterReplacement;
    var attrs = attrToSet.attrs;
    for(var key in attrs) {
      var value = attrs[key];
      key = standardizeKey_(key);
      var setMethod = key.length > 0 && ("set" + key[0].toUpperCase() + key.substring(1));
      if(!setMethod) continue;
      value = convertSpecialValue_(setMethod, value);
      if(key != "text" && key != "attributes" && 
         key.length > 0 && txt[setMethod]) {
        txt[setMethod](start, endAfterReplacement, value);
      }
    }
  }
  
  return insertedElements;
}

// Inserts the rich value "value" at the start position of the txt element.
// @param positions : Array DRange    An array of positions
// Value is either string (raw text), [string, attributes] or [string tag, attributes, children]
// To encode a sequence of elements instead of a single element, wrap them in a list
// Returns an array of DRange (inserted text or elements)
// exprs is passed on in case their namedRange need to be removed and re-added to the doc.
function insertRichValue_(doc, positions, values, expr, exprs) {
  var insertPosition;
  var deleteAction = function() {};
  var thingsToDelete = [];
  for(var p in positions) { // Delete previous positions if they were ranges
    var position = positions[p];
    if(isTextRange(position)) {
      var txt = position.txt;
      var start = position.start;
      var endInclusive = position.endInclusive;
      if(typeof endInclusive !== "undefined") {
        thingsToDelete.push(position);
      }
      if(typeof insertPosition == "undefined") {
        insertPosition = {ctor: "TextPosition", txt: txt, start: start};
      }
    } else { // We have to remove the element but keep track of where to insert the rich values back.
      var element = position.element;
      var parent = element.getParent();
      var index = parent.getChildIndex(element);
      if(typeof insertPosition == "undefined") {
        insertPosition = {ctor: "IndexPosition", parent: parent, index: index};
      }
      thingsToDelete.push({ctor: "Element", element: element});
    }
  }
  if(expr && expr.namedRange) {
    thingsToDelete.push({ctor: "NamedRange", expr: expr});
  }
  var toInsert = valuesToElementsToInsert_(values);
  if(toInsert.length == 0) throw "Cannot insert an empty array of elements or text nodes";
  // Check if all the elements to insert can be inserted.
  // Rules: If there are Table, Paragraphs and ListItems, then the formula should span the entire paragraph.
  var notallBodyChildren = false;
  var foundBodyChildren = false;
  for(var i in toInsert) {
    if(toInsert[i].ctor == "element") {
      var tag = toInsert[i].tag;
      if(tag == "ListItem" || tag == "Table" || tag == "Paragraph") {
        foundBodyChildren = tag;
      } else {
        notallBodyChildren = tag;
      }
    } else {
      notallBodyChildren = "text";
    }
  }
  if(foundBodyChildren) { // To the deletion of text, we need to delete the parent and update the insertion position.
    if(notallBodyChildren) {
      throw ("Cannot insert " + foundBodyChildren +
             " because it's alongside with elements that cannot be inserted at the top-level document level (" + notallBodyChildren + ")" +
             ". To keep " + foundBodyChildren + ", wrap other elements to insert (such as strings or inline images) in paragraphs, e.g. " +
             '["p", {}, ["Some text here"]]');
    } else { // All children are body.
      // We check that the insertion point is either an index position with a compatible parent
      if(insertPosition.ctor == "IndexPosition") {
        // Fine here. We reuse the same position.
      } else {
        // Or if it's a text (because it's a formula=, it occupies the entire paragraph
        var txt = insertPosition.txt;
        var parent = txt.getParent();
        var preciseError = "";
        var checkSingleChild = parent.getNumChildren() == 1;
        if(!checkSingleChild) {
          preciseError += " The area containing the formula should have only one child, the formula itself. Got " + parent.getNumChildren() + " children";
        }
        var thingsToDeleteLengthIsOne = thingsToDelete.length >= 1;
        if(!thingsToDeleteLengthIsOne) {
          preciseError += " The formula should span one element, but it spans " + (thingsToDelete.length) + " elements."
        }
        var checkIsTextRange = thingsToDeleteLengthIsOne && isTextRange(thingsToDelete[0]);
        if(thingsToDeleteLengthIsOne && !checkIsTextRange) {
          preciseError += " The area containing the formula is not a text range";
        }
        var insertPositionAtBeginning = checkIsTextRange && insertPosition.start == 0;
        if(checkIsTextRange && !insertPositionAtBeginning) {
          preciseError += " The formula should be at the beginning. Remove '"+thingsToDelete[0].txt.getText().substring(0, insertPosition.start)+"'.";
        }
        var formulaEndsAtEnd = checkIsTextRange && thingsToDelete[0].txt.getText().length != thingsToDelete[0].endInclusive + 1;
        if(formulaEndsAtEnd) {
          preciseError += " There should not be trailing text after the formula. Remove '" + thingsToDelete[0].txt.getText().substring(thingsToDelete[0].endInclusive + 1) +"'.";
        }
        
        // Need to check that the only thing to delete is some text spanning the entire siblings
        if(preciseError != "") {
          throw preciseError;
        }
        thingsToDelete = [{ctor: "Element", element: parent}];
        var parentParent = parent.getParent();
        insertPosition = {ctor: "IndexPosition", parent: parentParent, index: parentParent.getChildIndex(parent)};
      }
    }
  }
  // Now that we have the content to insert, we can delete the previous content
  for(var d in thingsToDelete) {
    var toDelete = thingsToDelete[d];
    if(toDelete.ctor == "TextRange") {
      toDelete.txt.deleteText(toDelete.start, toDelete.endInclusive);
    } else if(toDelete.ctor == "Element") {
      // We delete elements after the new ones are inserted, to prevent empty element list errors.
      //toDelete.element.removeFromParent();
    } else if(toDelete.ctor == "NamedRange") { // expression
      var expr = toDelete.expr;
      expr.namedRange.remove(); // This is not automatic unfortunately
      expr.namedRange = undefined;
      expr.range = undefined;
    }
  }
 
  var insertedElements = insertAtPosition_(doc, insertPosition, toInsert, exprs);
  
  // Now that we have the content to insert, we can delete the previous content
  for(var d in thingsToDelete) {
    var toDelete = thingsToDelete[d];
    if(toDelete.ctor == "TextRange") {
      //toDelete.txt.deleteText(toDelete.start, toDelete.endInclusive);
    } else if(toDelete.ctor == "Element") {
      // Check that this element is not the last paragraph of a part of the document.
      // IF so, we have to delete this element later
      var parent = toDelete.element.getParent();
      var childIndex = parent.getChildIndex(toDelete.element);
      var tpe = toDelete.element.getType();
      if(childIndex + 1 == parent.getNumChildren() && parent.appendParagraph && (
         tpe == DocumentApp.ElementType.PARAGRAPH ||
         tpe == DocumentApp.ElementType.LIST_ITEM ||
         tpe == DocumentApp.ElementType.TABLE)) {
        // Need to append an empty paragraph before deleting this element.
        parent.appendParagraph("");
      }
      toDelete.element.removeFromParent();
    } else if(toDelete.ctor == "NamedRange") { // expression
      /*var expr = toDelete.expr;
      expr.namedRange.remove(); // This is not automatic unfortunately
      expr.namedRange = undefined;
      expr.range = undefined;*/
    }
  }

  return insertedElements;
}

function colorize_(positions, color) {
  for(var p in positions) {
    var position = positions[p];
    if(isTextRange(position)) {
      var txt = position.txt;
      var start = position.start;
      var endInclusive = position.endInclusive;
      txt.setBackgroundColor(start, endInclusive, color);
    } else {
      var style = {};
      style[DocumentApp.Attribute.BACKGROUND_COLOR] = color;
      if(position.element && position.element.setAttributes) {
        position.element.setAttributes(style);
      }
    }
  }
}

function colorexprs_(color, doc) {
  var doc = doc || DocumentApp.getActiveDocument();
  var exprs = extractExprs_(doc)
  List.foreach(exprs, function(expr) {
    if(!expr.range) return;
    var positions = drangesOf_(expr.range);
    if(isUnderSelections_(doc, positions)) {
      for(var p in positions){
        colorize_(positions[p], color);
      }
    }
  });
}
function markformulas(options, docProperties) {
  options = options || defaultOptions;
  colorexprs_(HIGHLIGHT_VALUE_COLOR);
}
function unmarkformulas(options, docProperties) {
  options = options || defaultOptions;
  colorexprs_(UNHIGHLIGHT_VALUE_COLOR);
}

function removeNameRangeAndHighlighting_(name, doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var namedRanges = doc.getNamedRanges(name);
  
  for(var i in namedRanges) {
    var namedRange = namedRanges[i]
    var ranges = namedRange.getRange();
    var positions = drangesOf_(ranges);
    if(isUnderSelections_(doc, positions)) {
      for(var p in positions) {;
        colorize_(positions[p], UNHIGHLIGHT_VALUE_COLOR);
      }
    }
    namedRange.remove();
  }
}

function revealFormulas(options, docProperties, doc, body) {
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  options = options || defaultOptions;
  removeNameRangeAndHighlighting_(REVEALED_FORMULA_NAME, doc, body);
  detectFormulaRanges_(doc ,body);
  var exprs = extractExprs_(doc);
  var numRevealed = 0;
  List.foreach(exprs, function(expr) {
    if(!expr.range) return;
    var positions = drangesOf_(expr.range);
    if(isUnderSelections_(doc, positions)) {
      numRevealed += 1;
      // Remove everything but keep an insertion point.
      // If two text elements are consecutive, we merge them.
      var txt;
      var lastTxt;
      var lastStart;
      var lastParent;
      var lastChildIndex;
      var charAfterLastTextSelectionIsLetter = false;
      if(positions.length == 0) return;
      for(var p in positions) {
        var position = positions[p];
        if(isTextRange(position)) {
          txt = position.txt;
          var start = position.start;
          var endInclusive = position.endInclusive;
          if(start == 0 && lastTxt && txt.getText().length <= endInclusive + 1) {
            txt.removeFromParent();
          } else {
            charAfterLastTextSelectionIsLetter =
              isLetter(txt.getText().substring(endInclusive + 1, endInclusive + 2));
            txt.deleteText(start, endInclusive);
            lastTxt = txt;
            lastStart = start;
          }
        } else {
          // It could be other elements inside a paragraph, InlineImage, page break.
          // Or it could be body-level elements (paragraphs, listItems, and tables)
          var tpe = position.element.getType();
          var bodyLevel =
              tpe == DocumentApp.ElementType.PARAGRAPH || 
                tpe == DocumentApp.ElementType.TABLE || 
                  tpe == DocumentApp.ElementType.LIST_ITEM;
          lastParent = position.element.getParent();
          lastChildIndex = lastParent.getChildIndex(position.element); // Should always stay the same
          if(bodyLevel) {
            if(!lastTxt) {
              lastTxt = position.element.getParent().insertParagraph(lastChildIndex, "");
              lastStart = 0;
            }
          } else {
            var prev = position.element.getPreviousSibling();
            if(prev && prev.getType() == DocumentApp.ElementType.TEXT) {
              lastTxt = prev;
              lastStart = lastTxt.getText().length;
            }
          }
          position.element.removeFromParent();
        }
      }
      var sourceToInsert =
            endsWithLetter(expr.source) && charAfterLastTextSelectionIsLetter ?
              wrapsWithParens(expr.source) : expr.source;
      if(typeof lastTxt === "undefined") { //The elements remaining to the left of the deletion is not a text
        if(lastChildIndex >= lastParent.getNumChildren()) { // No child afterwards
          txt = lastParent.appendText(sourceToInsert);
          start = 0;
        } else {
          var next = lastParent.getChild(lastChildIndex);
          if(next && next.getType() == DocumentApp.ElementType.TEXT) {
            txt = next;
            txt.insertText(0, sourceToInsert);
            start = 0;
          } else {
            txt = lastParent.insertText(lastChildIndex, sourceToInsert);
            start = 0;
          }
        }
      } else {
        txt = lastTxt;
        start = lastStart;
        var nextSibling = txt.getNextSibling();
        var l = txt.getText();
        if(nextSibling && nextSibling.getType() == DocumentApp.ElementType.TEXT) {
          var t = nextSibling.getText();
          nextSibling.merge(); // Will not change anything
        }
        var u = txt.getText();
        txt.insertText(start, sourceToInsert);
        var w = txt.getText();
        Logger.log("before merge (left):'" + l + "'\nbefore merge (right):'" + t + "'\nafter merge (total):'" + u + "'\nAfter insertion:'" + w + "'");
      }
      var endFormula = start + expr.source.length - 1;
      if(options.highlightFormulas == "true") {
        if(txt.getType() == DocumentApp.ElementType.PARAGRAPH) {
          txt = txt.getChild(0);
        }
        txt.setBackgroundColor(start, endFormula, REVEALED_FORMULA_COLOR);
        txt.setFontFamily(start, endFormula, REVEALED_FORMULA_FONT);
        addRange_(doc, REVEALED_FORMULA_NAME, [TextRange(txt, start, endFormula)]);
      }
    }
  });
  return {feedback: "Revealed " + numRevealed + " formulas"};
};

function testNameSelection() {
  nameSelection({nameFormulasInline: "false"}, getDocProperties());
}

function nameSelection(options, docProperties, existingNames, doc, body) {
  options = options || defaultOptions;
  var nameFormulasInline = options.nameFormulasInline === "true";
  var doc = doc || DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  var selectionElements = selection ? selection.getRangeElements() : undefined;
  
  if(!selectionElements) {
    throw "Please select some text or elements and try again"
  }
  Logger.log(uneval_(existingNames))
  
  var ui = DocumentApp.getUi();
  var lastHint = "";
  var name;
  while(true) {
    var response = ui.prompt('Name selection', lastHint + 'Give a name to your selection', ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() == ui.Button.CANCEL ||
        response.getSelectedButton() == ui.Button.CLOSE) {
      return {feedback: "Renaming cancelled"}
    }
    name = response.getResponseText();
    var vn = new RegExp("^" + varName + "$");
    if(!name || !vn.exec(name)) {
      lastHint = ("/!\\ '" + name + "' is not a valid name.\nNames contains only letters, '_' or '$' and digits, but should not start with a digit.\n");
      continue;
    }
    if(existingNames && typeof existingNames[name] != "undefined") {
      lastHint = ("/!\\ The name '" + name + "' is already assigned. Please enter another fresh name.\n");
      continue;
    }
    break;
  }
  var exprs = extractExprs_(doc);
  
  var dranges = drangesOf_(selection);
  // Let's build the formula that can generate this range.
  var formulaElements = [];
  var textSelected = false;
  var elemsSelected = false;
  var argumentNames = [];
  var argumentValues = [];
  var lastElem = "";
  var pureString = true;
  var filteredSelection = []; // Only computable elements;
  var charAfterLastTextSelectionIsLetter = false;
  foreachDRange_(
    selection,
    function(txt, start, endInclusive) {
      if(elemsSelected) {
        throw ("Cannot name top-level text and elements at the same time")
      }
      var rangesBeneath = [];
      List.foreach(exprs, function(expr) {
        foreachDRange_(
          expr.range,
          function(txt2, start2, endInclusive2) {
            if(areSameElement_(txt, txt2) && !(endInclusive2 < start || endInclusive < start2)) {
              if(start <= start2 && endInclusive2 <= endInclusive) { // Formula totally included
                rangesBeneath.push([start2, endInclusive2, formulaOf_(expr), expr.name]);
              } else { // Partial inclusion: We cannot do this
                if(start2 <= start && endInclusive <= endInclusive2) { // One of them is strict
                  throw ("The selection is at the position "+(start - start2 + 1)+" of a formula ("+expr.source+") that generates ("+txt.getText().substring(start2, endInclusive2 + 1)+").\nIt's not yet possible to name something inside a formula.")
                }
                if(endInclusive >= endInclusive2) {
                  throw ("The first " + (endInclusive2 - start + 1) + " chars of the selection ("+txt.getText().substring(start, endInclusive2 + 1)+") partially cover a formula " +
                    "(" + expr.source + ") that generates ("+txt.getText().substring(start2, endInclusive2 + 1)+"). Please avoid partially selecting formulas before naming them.");
                } // endInclusive >= start2
                throw ("The last " + (endInclusive - start2 + 1) + " chars of the selection ("+txt.getText().substring(start2, endInclusive + 1)+") partially cover a formula " +
                  "(" + expr.source + ") that generates ("+txt.getText().substring(start2, endInclusive2 + 1)+"). Please avoid partially selecting formulas before naming them.");
              }
            }
          },
          function(element2) {
            if(isDescendantOf_(element2, txt)) {
              throw ("'" + txt.getText().substring(start, endInclusive + 1) +"' is partially contained in a generated element and thus cannot be extracted for now.");
            } // Else it's fine.
          });
      });
      var txtText = txt.getText();
      //var value = txtText.substring(start, endInclusive + 1);
      var lastIndex = start;
      for(var k in rangesBeneath) {
        pureString = false;
        var r = rangesBeneath[k];
        var start_ = r[0];
        var endInclusive_ = r[1];
        var formula_ = r[2];
        var name_ = r[3];
        if(lastIndex < start_) {
          var x = txtText.substring(lastIndex, start_);
          if(start_ > lastIndex)
            formulaElements.push(uneval_(toRichTextFormula(txt, lastIndex, start_ - 1)));
        }
        if(name_) {
          formulaElements.push(name_);
          argumentNames.push(name_);
          argumentValues.push(formula_);
        } else {
          formulaElements.push(formula_); // Name, call or parentheses.
        }
        lastIndex = endInclusive_ + 1;
      }
      if(lastIndex != endInclusive + 1) {
        lastElem = txtText.substring(lastIndex, endInclusive + 1);
        var final = toRichTextFormula(txt, lastIndex, endInclusive);
        formulaElements.push(uneval_(final));
        pureString = pureString && typeof final === "string";
      }
      textSelected = true;
      filteredSelection.push(TextRange(txt, start, endInclusive));
      charAfterLastTextSelectionIsLetter =
        isLetter(txtText.substring(endInclusive + 1, endInclusive + 2));
    },
    function(element) {
      // If the element is a table cell, and if it's the first one, we consider the table instead.
      if(element.getType() == DocumentApp.ElementType.TABLE_CELL) {
        if(element.getParent().getChildIndex(element) === 0) {
          element = element.getParent();
        } else return;
      }
      if(element.getType() == DocumentApp.ElementType.TABLE_ROW) {
        if(element.getParent().getChildIndex(element) === 0) {
          element = element.getParent();
        } else return;
      }
      if(textSelected) {
        throw ("Cannot name top-level elements and text at the same time");
      }
      var found = false;
      List.foreach(exprs, function(expr) {
        foreachDRange_(
          expr.range,
          function(txt2, start2, endInclusive2) {
            if(isDescendantOf_(txt2, element)) {
              throw ("'" + txt2.getText().substring(start2, endInclusive2 + 1) +"' is generated and strictly contained in the selection. This pattern is not supported yet. please change your selection")
            }
          },
          function(element2) {
            if(areSameElement_(element, element2)) {
              formulaElements.push(formulaOf_(expr));
              found = true;
            } else if(isDescendantOf_(element2, element)) {
              throw ("The selected element '" + element +
                     "' is partially contained in a generated element (formula : " + formulaOf_(expr) +
                     ") and thus cannot be extracted for now.");
            } else if(isDescendantOf_(element, element2)) {
              throw ("The selected element '" + element +
                     "' contains a generated element (formula : " + formulaOf_(expr) +
                     ") and thus cannot be extracted for now.");
            }
          });
      });
      if(!found) {
        formulaElements.push(uneval_(elementToValue(element)));
      }
      elemsSelected = true;
      pureString = false;
      filteredSelection.push(Element(element));
    });
  // Here formulaElements.length is always > 0
  if(formulaElements.length == 0) {
    throw "None of the selected elements could be extracted";
  }
  var formula = formulaElements.length == 1 ? formulaElements[0] : "[" + formulaElements.join(",\n") + "]"; 
  
  var toAppendToSidebarEnv = "";
  var feedback = "";
  var maybefunction = "";
  if(argumentNames.length == 0) {
    if(nameFormulasInline) {
      formula = "=(/*"+name+"=*/" + formula + ")";
    } else {
      if(pureString && lastElem.length > 0 && !(/^\s|\s$/.exec(lastElem))) {
        toAppendToSidebarEnv = name + " = " + lastElem;
      } else {
        toAppendToSidebarEnv = name + " = " + 
          (formula && (formula[0] == "[" || formula[0] == "(") ? formula : "(" + formula + ")");
      }
      formula = "=" + (charAfterLastTextSelectionIsLetter ? "(" + name + ")" : name);
    }
  } else {
    if(!nameFormulasInline) {
      feedback += "\nExtracted as inline named function because of the presence of inline named formulas."
    }
    formula = "=(/*"+name+"("+argumentNames.join(",")+")=*/(function("+
      argumentNames.join(",")
    +") { return " + formula + ";})("+
      argumentValues.join(",")
    +"))";
    maybefunction = "("+argumentNames.join(",")+")";
  }
  removeFormulas_(doc, selection);
  addRange_(doc, formulaValue_(formula, undefined), filteredSelection);
  var sidebarEnv = docProperties.sidebarEnv;
  if(toAppendToSidebarEnv) {
    docProperties.sidebarEnv = docProperties.sidebarEnv + (docProperties.sidebarEnv ? "\n" : "") + toAppendToSidebarEnv;
    maybeSaveNewSidebarEnv(docProperties.sidebarEnv, sidebarEnv);
  }
  var result = evaluateFormulas(options, docProperties, doc); // Might modify the new sidebarEnv
  if(!result) result = {};
  if(!result.feedback) result.feedback = "";
  result.feedback = "Selection has been named '" + name + "'. You can now type =" + name + maybefunction +  " anywhere in the doc to reuse it.\n" + result.feedback + feedback;
  return result;
}

function insertFormulaAtCursor(options, docProperties, formulaValue, doc) {
  var doc = doc || DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  var elements = selection ? selection.getRangeElements() : [];
  var txt;
  var start;
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    // Only modify elements that can be edited as text; skip images and other non-text elements.
    if (element.getElement().editAsText) {
      txt = element.getElement().editAsText();
      // Bold the selected part of the element, or the full element if it's completely selected.
      if (element.isPartial()) {
        start = element.getStartOffset();
        txt.deleteText(start, element.getEndOffsetInclusive());
      } else {
        start = 0;
        txt.deleteText(0, text.getText().length - 1);
      }
    }
  }
  
  var cursor = doc.getCursor();
  var formula = formulaValue.formula;
  var strvalue = formulaValue.strvalue;
  var value = eval(strvalue);
  
  if(cursor) {
    txt = cursor.getSurroundingText();
    start = cursor.getSurroundingTextOffset();
  }
  if(!txt) {
     throw "Position your cursor in the area where you want to insert the formula"
  }
  var insertedPositions = insertRichValue_(doc, [TextRange(txt, start, undefined)], value);
  addRange_(doc, formulaValue_(formula, strvalue), insertedPositions);
  for(var i in insertedPositions) {
    var position = insertedPositions[i];
    if(isTextRange(position)) {
      var newPosition = doc.newPosition(position.txt, position.endInclusive + 1);
      doc.setCursor(newPosition);
    }
  }
  return "Inserted " + formula + " at the cursor position";
}

// Default document properties, shared accross users
var defaultProperties = {
  sidebarEnv: ""
}

// Default user properties
var defaultOptions = {
  nameFormulasInline: "false",
  highlightFormulas: "true",
  highlightValues: "false",
  refreshImages: "true",
  nextReminderDate: "0" // 0 means "not asked yet", -1 means "never", else it's a date.
};
/**
 * Gets the stored user preferences for the origin and destination languages,
 * if they exist.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @return {Object} The user's origin and destination language preferences, if
 *     they exist.
 */
function getUserPreferences() {
  var userProperties = PropertiesService.getUserProperties();
  var properties = {};
  for(var k in defaultOptions) {
    properties[k] = userProperties.getProperty(k) || defaultOptions[k];
  }
  return properties;
}
function setUserPreference(name, value) {
  PropertiesService.getUserProperties()
    .setProperty(name, value);
}

function getDocProperties() {
  var docProperties = PropertiesService.getDocumentProperties();
  var properties = {};
  for(var k in defaultProperties) {
    properties[k] = docProperties.getProperty(k) || defaultProperties[k];
  }
  return properties;
}
function setDocProperty(name, value, oldValue) {
  var p = PropertiesService.getDocumentProperties();
  var currentValue = p.getProperty(name);
  if(currentValue != oldValue && typeof currentValue == "string" && typeof oldValue == "string") {
    value = mergeModifications(oldValue, currentValue, value);
  }
  //Logger.log("setDocProperty(" + uneval_(name) + ", " + uneval_(value) + ")");
  p.setProperty(name, value);
  return value;
}

function hideDefinitions(options, docProperties, doc, body) {
  options = options || defaultOptions;
  docProperties = docProperties || getDocProperties();
  //var docProperties = PropertiesService.getDocumentProperties();
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var namedRanges = doc.getNamedRanges(DEFINITION_PARAGRAPHS);
  // Take everything marked as a definition paragraph, including comments in between.
  var error = "";
  var hiddenAgain = "";
  var moved = [];
  foreachNamedRange_(
    namedRanges,
    function(name, range, namedRange) {
      // Everything between the leftmost range and the rightmost range should be added.
      var toSort = [];
      foreachDRange_(
        range,
        function(txt, start, endInclusive, rangeElement) {
          toSort.push([name, rangeElement, getPathUntilBody_(txt), start]);
        },
        function(element, rangeElement) {
          toSort.push([name, rangeElement, getPathUntilBody_(element)]);
        });
      toSort.sort(sortingFunction);
      if(!toSort.length) return;
      var min = toSort[0];
      var max = toSort[toSort.length - 1];
      var minPath = min[2];
      var maxPath = max[2];
      var minElement = min[1].getElement();
      minElement = minElement.getType() == DocumentApp.ElementType.TEXT ? minElement.getParent() : minElement;
      var tmp = minElement;
      var prev;
      var toRemove = [];
      while(tmp && comparePaths(getPathUntilBody_(tmp), maxPath) <= 0) {
        prev = tmp;
        toRemove.push(tmp);
        var s = tmp.getText();
        hiddenAgain = hiddenAgain + (hiddenAgain == "" || s == "" ? "" : "\n") + s;
        tmp = tmp.getNextSibling();
      }
      for(var t in toRemove) {
        try {
          toRemove[t].removeFromParent();
        } catch(err) {
          error = error + (error == "" || err == "" ? "" : "\n") + err;
        }
      }
      namedRange.remove();
    });
  var acc = ""; // New definitions
  var env = collectEnv_(doc, body);
  var sidebarEnv = docProperties.sidebarEnv; // docProperties.getProperty("sidebarEnv");
  List.foreach(env, function(binding) {
    if(!binding.value.expr) return;
    var range = binding.value.expr.range;
    if(range) {
      acc = binding.name + " = " + binding.value.expr.source + (acc == "" ? "" : "\n") + acc;
      moved.unshift(binding.name);
      try {
      foreachDRange_(range,
                     function(txt, start, endInclusive) {
                       txt.getParent().removeFromParent();
                     },
                     function(element) {
                       element.removeFromParent();
                     });
      } catch(e) {
        error += " Could not delete definition for '" + binding.name +"': " + e + ". Please delete it manually";
      }
    }
  });
  var acc = hiddenAgain + (hiddenAgain == "" || acc == "" ? "" : "\n") + acc;
  var newSidebarEnv = sidebarEnv + (sidebarEnv == "" || acc == "" ? "" : "\n") + acc;
  PropertiesService.getDocumentProperties().setProperty("sidebarEnv", newSidebarEnv);
  var feedback = moved.length ? "Moved the definitions of " + moved.join(", ") + " to above. " : "";
  maybeSaveNewSidebarEnv(newSidebarEnv, sidebarEnv);
  return {feedback: feedback + error, newSidebarEnv: newSidebarEnv};
}
                   
function maybeSaveNewSidebarEnv(newSidebarEnv, sidebarEnv) {
  Logger.log("maybeSaveNewSidebarEnv(" + uneval_(newSidebarEnv) + ", " + uneval_(sidebarEnv) + ")");
  if(sidebarEnv != newSidebarEnv) {
    setDocProperty("sidebarEnv", newSidebarEnv, sidebarEnv);
  }
}

function showDefinitions(options, docProperties, doc, body) {
  options = options || defaultOptions;
  docProperties = docProperties || getDocProperties();
  //var docProperties = PropertiesService.getDocumentProperties();
  var doc = doc || DocumentApp.getActiveDocument();
  var body = body || doc.getBody();
  var sidebarEnv = docProperties.sidebarEnv; // docProperties.getProperty("sidebarEnv");
  if(sidebarEnv.trim() == "") {
    return {feedback: "Nothing to move."};
  }
  var lines = sidebarEnv.split("\n");
  var rangeBuilder = doc.newRange();
  var lastPar = undefined;
  for(var i = lines.length - 1; i >= 0; i--) {
    var line = lines[i];
    var par = body.insertParagraph(0, line);
    lastPar = lastPar || par;
    var style = {};
    style[DocumentApp.Attribute.FONT_FAMILY] = 'Consolas';
    style[DocumentApp.Attribute.FONT_SIZE] = 14;    
    // Append a plain paragraph.
    
    // Apply the custom style.
    par.setAttributes(style);
    rangeBuilder.addElement(par);
  }
  if(lastPar) {
    lastPar.appendPageBreak();
  }
  
  var range = rangeBuilder.build();
  doc.addNamedRange(DEFINITION_PARAGRAPHS, range);
  return {feedback: "Done.", newSidebarEnv: ""};
}