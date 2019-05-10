///////////////// Range methods /////////////////////////

function rangeFromPositions(doc, positions) {
  var rangeBuilder = doc.newRange();
  for(var p in positions) {
    var position = positions[p];
    if(isTextRange(position)) {
      rangeBuilder.addElement(position.txt, position.start, position.endInclusive);
    } else {
      rangeBuilder.addElement(position.element);
    }
  }
  return rangeBuilder.build();
}

var shortenedPrefix = "@" + "3E5EBC06C2916285F48931ACC5D334AC" + "@" // MD5 of "pbneozrn mkjgspv rmaz!embrmkjlw j!mkfv! ekzijm :,df ep"

// Store the name somewhehre
function storeLongName(longName) {
  var firstChar = longName.length && longName[0] == "=" ? "=" : "";
  var p = PropertiesService.getDocumentProperties();
  var key = firstChar + shortenedPrefix + Date.now() + longName;
  key = key.substring(0, 200) + "...";
  p.setProperty(key, longName);
  return key;
}

// Garbage collect names that are no longer used in the doc.
function garbageCollectLongNames(namesFound, prefix) {
  var p = PropertiesService.getDocumentProperties();
  var keys = p.getKeys();
  for(var k in keys) {
    var key = keys[k];
    if(isExpandable(key) && key.substring(0, prefix.length) == prefix
      && typeof namesFound[key] == "undefined") {
      p.deleteProperty(key)
    }
  }
}

// Returns true if the name is something to expand
function isExpandable(name) {
  return name.length >= 2 &&
    (name[0] == "=" && name[1] == "@" &&
     name.substring(1, shortenedPrefix.length + 1) == shortenedPrefix ||
      name[0] == "@" &&
        name.substring(0, shortenedPrefix.length) == shortenedPrefix);
}

// Parse a named range and possibly returns the longer name stored in the propertiesService.
function maybeExpandLongName(name) {
  if(isExpandable(name)) {
    var p = PropertiesService.getDocumentProperties();
    return p.getProperty(name);
  }
  return name;
}

// Given a namedRange, returns its name (possibly retrieved from the document properties)
function getNamedRangeLongName(namedRange) {
  return maybeExpandLongName(namedRange.getName())
}

// Add the given range with a name.
// insertPosition is an Array DRange or a Range
function addRange_(doc, name, insertPositions) {
  if(name.length >= 255) {
    name = storeLongName(name);
  }
  var range = 
      insertPositions.getRangeElements ? insertPositions :
      rangeFromPositions(doc, insertPositions);
  return doc.addNamedRange(name, range);
}

// type DRange = TextRange (txt: Text) (start: Start) (endInclusive:EndInclusive)
               //| Element (element: Element)

function isTextRange(drange) { return drange.ctor == "TextRange"; }
function TextRange(txt, start, endInclusive) {
  return {ctor: "TextRange", txt: txt, start: start, endInclusive: endInclusive};
}
function Element(element) {
  return {ctor: "Element", element: element};
}

// returns Array Position
function drangesOf_(range) {
  var result = [];
  foreachDRange_(
    range,
    function(txt, start, endInclusive) {
      result.push(
        {ctor: "TextRange",
         txt: txt,
         start: start,
         endInclusive: endInclusive}); },
    function(element) {
      result.push({ctor: "Element",
                   element: element});
    });
  return result;
}

// Stops with the callback's value if not undefined
function foreachDRange_(range, callbackTxt, callbackElement) {
  if(!range || !range.getRangeElements) return;
  var rangeElements = range.getRangeElements();
  var result = [];
  var i = 0;
  while(i < rangeElements.length) {
    var element = rangeElements[i].getElement();
    if(element && element.getType() == DocumentApp.ElementType.TEXT
       && rangeElements[i].getStartOffset() > -1
       && rangeElements[i].getEndOffsetInclusive() > -1) {
         var x = callbackTxt ? callbackTxt(element, rangeElements[i].getStartOffset(), rangeElements[i].getEndOffsetInclusive(), rangeElements[i], range) : undefined;
         if(x) return x;
    }
    if(element.getType() != DocumentApp.ElementType.TEXT) {
      var x = callbackElement ? callbackElement(element, rangeElements[i], range) : undefined;
      if(x) return x;
    }
    i++;
  }
  return;
}

///////////////// Element methods /////////////////////////

function comparePaths(p1, p2) {
  var i = 0;
  while(i < p1.length && i < p2.length) {
    if(p1[i] < p2[i]) return -1;
    if(p2[i] < p1[i]) return 1;
    i++;
  }
  if(i == p1.length && i == p2.length) {
    return 0;
  }
  if(i < p1.length) {
    return -1;
  }
  return 1;
}

function isBeforeElement(element1, element2) {
  var p1 = getPathUntilDoc_(element1);
  var p2 = getPathUntilDoc_(element2);
  if(comparePaths(p1, p2) < 0) return true;
  return false;
}

function areSameElement_(element1, element2) {
  return getPathUntilDoc_(element1).join("<") == getPathUntilDoc_(element2).join("<");
}

function isDescendantOf_(element1, element2) {
  var path1 = getPathUntilDoc_(element1).join(">");
  var path2 = getPathUntilDoc_(element2).join(">");
  return path2.length <= path1.length && path1.substring(0, path2.length) === path2;
}

function getPathUntilDoc_(element) {
  var path = [];
  while(element && element.getType && element.getType() != DocumentApp.ElementType.DOCUMENT && element.getParent()) {
    var parent = element.getParent();
    path.unshift(parent.getChildIndex(element));
    element = parent;
  }
  return path;
}

function walkAll_(el, callbackOnText, callbackBeforeWalk, callbackAfterWalk) {
  if(callbackBeforeWalk) {
    if(callbackBeforeWalk(el)) return;
  }
  if(el.getType() == DocumentApp.ElementType.TEXT) {
    return callbackOnText ? callbackOnText(el) : undefined;
  } else if(el.getNumChildren) {
    for(var i = 0; i < el.getNumChildren(); i ++) {
      walkAll_(el.getChild(i), callbackOnText, callbackBeforeWalk, callbackAfterWalk);
    }
  }
  if(callbackAfterWalk) {
    if(callbackAfterWalk(el)) return;
  }
}

///////////////// Selections methods /////////////////////////

// isUnderSelections_: Document -> Array DRange -> Bool
function isUnderSelections_(doc, positions, selection, selectionElements) {
  var selection = selection || doc.getSelection();
  var selectionElements = selectionElements || (selection ? selection.getRangeElements() : undefined);
  
  if(selectionElements) {
    var underSelection = false;
    for(var p in positions) {
      var position = positions[p];
      for(var i in selectionElements) {
        var selectionElement = selectionElements[i];
        if(selectionElement.getElement().getType() == DocumentApp.ElementType.TEXT &&
           isTextRange(position)) {
          var txt = position.txt;
          var start = position.start;
          var endInclusive = position.endInclusive;
          var e = selectionElement.getElement();
          var start_ = selectionElement.getStartOffset();
          var endInclusive_ = selectionElement.getEndOffsetInclusive();
          if(areSameElement_(e, txt)
             && !(endInclusive_ < start) && !(start_ > endInclusive)
          ) {
            underSelection = true;
          }
        } else { // Consider all text nodes inside.
          walkAll_(
            selectionElement.getElement(),
            isTextRange(position) ?  function(e) {
            if(areSameElement_(e, position.txt)) {
              underSelection = true;
            }
            } : undefined, isTextRange(position) ? undefined : function(e) {
            if(areSameElement_(e, position.element)) {
              underSelection = true;
              return true;
            }
            return false;
          });
        }
      }
    }
    return underSelection;
  } else {
    return true;
  }
}

function elementToObject_(element) {
  if(element.getChild) {
    var children = [];
    var n = element.getNumChildren();
    for(var i = 0; i < n; i++) {
      children.push(elementToObject_(element.getChild(i)));
    }
    return [element + "", children];
  } else {
    return element + ""
  }
}

// Returns a list of DRange for a formula that starts with ( and ends with )
// [TextRange(txt, textStartIndex, textEndIndex - 1)]
function getFormulaOnMultipleParagraphs_(txt, start) {
  var string = txt.getText();
  string = sanitizeQuotes_(string);
  var delimiters = [];
  var endOffsetExclusive = start;
  var ranges = [];
  var currentStart = start;
  var toInclude = "TEXT";
  var uncle;
  var cousin;
  
  function maybeNextTxt() {
    if(endOffsetExclusive == string.length) {
      if(endOffsetExclusive > currentStart) {
        if(toInclude == "TEXT") {
          ranges.push(TextRange(txt, currentStart, endOffsetExclusive - 1));
        } else {
          ranges.push(Element(toInclude));
        }
      }
      if(txt.getNextSibling() && txt.getNextSibling().getType() == DocumentApp.ElementType.TEXT) {
        txt = txt.getNextSibling();
      } else {
        uncle = txt.getParent().getNextSibling();
        cousin = uncle && uncle.getNumChildren() && uncle.getChild(0);
        while(uncle && (!cousin || cousin.getType() != DocumentApp.ElementType.TEXT)) {
          uncle = uncle.getNextSibling();
          cousin = uncle && uncle.getNumChildren() && uncle.getChild(0);
        }
        if(cousin) {
          txt = cousin;
          toInclude = uncle;
        } else {
          txt = undefined;
        }
      }
      if(txt) { // Let's continue parsing
        currentStart = 0;
        endOffsetExclusive = 0;
        string = sanitizeQuotes_(txt.getText());
      }
    }
  }
  maybeNextTxt();
  
  while(txt && endOffsetExclusive < string.length) {
    var [endOffsetExclusive, _] = nextOffsetDelimiters_(string, endOffsetExclusive, delimiters);
    if(delimiters.length == 0) {
      break;
    }
    maybeNextTxt();
  }
  if(delimiters.length > 0) {
    return undefined;
  }
  if(txt && endOffsetExclusive > currentStart) {
    ranges.push(TextRange(txt, currentStart, endOffsetExclusive - 1));
  }
  return ranges;
}

function testInsertion() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  //var blob = UrlFetchApp.fetch("https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png").getBlob();
  var t = body.appendTable([["", ""],["",""]]);
  
  //p.appendInlineImage(blob);
  //body.appendParagraph("");
  testBodyStructure();
}

function testBodyStructure() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var bodyObject = elementToObject_(doc.getBody());
  Logger.log(uneval_(bodyObject));
  
  /*var txt = doc.getBody().editAsText();
  var search = txt.findText("world[\\s\\S]*hi");
  if(search) {
    Logger.log(search.getElement().getText());
    Logger.log(search.getStartOffset());
    Logger.log(search.getEndOffsetInclusive());
  }
  search = txt.findText("world[\\s\\S]*hi", search);
  if(search) {
    Logger.log(search.getElement().getText());
    Logger.log(search.getStartOffset());
    Logger.log(search.getEndOffsetInclusive());
  }*/
}
/**/

var minifyProperties = {};
minifyProperties[DocumentApp.Attribute.BACKGROUND_COLOR] = "background";
minifyProperties[DocumentApp.Attribute.FOREGROUND_COLOR] = "color";
minifyProperties[DocumentApp.Attribute.LINK_URL] = "url";
minifyProperties[DocumentApp.Attribute.GLYPH_TYPE] = "glyph";
minifyProperties[DocumentApp.Attribute.LIST_ID] = "id";
minifyProperties[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = "horizontal";
minifyProperties[DocumentApp.Attribute.STRIKETHROUGH] = "strike";

function minifyPropertyKey(key) {
  return typeof minifyProperties[key] !== "undefined" ? minifyProperties[key] :
    key.replace(/^(\w)|_(\w)|(\w)/g, function(match, start, mid, inside) {
      return start ? start.toLowerCase() : mid ? mid : inside.toLowerCase(); })
}

function testRichFormula() {
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  var selectionElements = selection ? selection.getRangeElements() : undefined;
  var txt = selectionElements[0].getElement();
  var start = selectionElements[0].getStartOffset();
  var endInclusive = selectionElements[0].getEndOffsetInclusive();
  Logger.log(uneval_(toRichTextFormula(txt, start, endInclusive)));
}

// We only store the style that is different from the surroundings (i.e. to the left)
function toRichTextFormula(txt, start, endInclusive) {
  var bufferStr = "";
  var text = txt.getText();
  var offset = start;
  var prevAttributes = undefined;
  var attributes = {};
  var baseAttributes = {};
  if(start > 0) baseAttributes = txt.getAttributes(start - 1);
  var textElements = [];
  function flush() {
    if(bufferStr != "") {
      var attrs = {};
      var hasAttribute = false;
      for(var k in prevAttributes) {
        var v = prevAttributes[k];
        if(((typeof v === "undefined" ||
           v === null) && typeof baseAttributes[k] === "undefined") ||
           baseAttributes[k] === v
          ) continue;
        v = (typeof v === "undefined" || v === null) ? false : v
        hasAttribute = true;
        attrs[minifyPropertyKey(k)] = v;
      }
      textElements.push(hasAttribute ? [bufferStr, attrs] : bufferStr);
      bufferStr = "";
    }
  }
  while(offset <= endInclusive) {
    attributes = txt.getAttributes(offset);
    if(typeof prevAttributes === "undefined" || uneval_(prevAttributes) == uneval_(attributes)) {
      bufferStr += text.substring(offset, offset + 1);
    } else {
      flush();
      bufferStr += text.substring(offset, offset + 1);
    }
    prevAttributes = attributes;
    offset++;
  }
  flush();
  if(textElements.length === 1) return textElements[0];
  return textElements;
}

