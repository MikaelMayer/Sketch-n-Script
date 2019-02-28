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

// Add the given range with a name.
// insertPosition is an Array DRange
function addRange_(doc, name, insertPositions) {
  return doc.addNamedRange(name, rangeFromPositions(doc, insertPositions));
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
  var p1 = getPathUntilBody_(element1);
  var p2 = getPathUntilBody_(element2);
  if(comparePaths(p1, p2) < 0) return true;
  return false;
}

function areSameElement_(element1, element2) {
  return getPathUntilBody_(element1).join("<") == getPathUntilBody_(element2).join("<");
}

function getPathUntilBody_(element) {
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
function isUnderSelections_(doc, positions) {
  var selection = doc.getSelection();
  var selectionElements = selection ? selection.getRangeElements() : undefined;
  
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
