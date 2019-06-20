var util = require('util');

var uneval = x => util.inspect(x, {depth: undefined, colors: true});

const inspect = function(what) {
  console.log(uneval(what));
  return what;
  //console.dir(what, {depth: undefined});
}

const inspectReturn = function(what) {
  console.log("return" + uneval(what));
  return what;
}


/*
type Prog = {[key: string]: Prog}
type RelativePath = {up: number, down: List String}
composePaths(p1: RelativePath, p2: RelativePath): RelativePath
type Diff = DClone (List String)
          | DUpdate (Reuse Model ChildDiffs | DMerge diff1 diff2
type ChildDiffs = {[key: string]: Diffs}
type Diffs = List Diff

-- Horizontal forward diff to modify the program to perform an evaluation step
type HDiff = HUpdate (Reuse RelativePath | New Model) HChildDiffs
type HChildDiffs = {[key: string]: HDiff}

-- Horizontal backward diff to unevaluate one step the program and its associated diff.
type RDiff = RUpdate (Reuse RelativePath | New Model) RChildDiffs | RMerge RDiff RDiff
type RChildDiffs = {[key: string]: List RDiff}
type RDiffs = List RDiff

Given the program, the system computes a (hDiffs: HDiffs) that explains how to transform the program in the output.
hDiffs = getEvalStepAsDiff(prog: Prog): HDiff //the horizontal diff.
result = applyHDiffs(hDiff, prog): Prog

The user creates the vertical (resultDiffs: Diffs) so that, if result' is the new Prog, then applyDiffs(resultDiffs, result) = result' for any diff in resultDiffs.

But the result' is not back-propagated, only resultDiffs and result are.
Indeed, for now there is only one result', but in the process we might back-propagate several programs.

Given the diffs for result, we now want to obtain the diffs for program.
progDiffs = magicFunction(hDiffs, resultDiffs)

To do this, one idea is to
1) Derive a rDiffs from prog and hDiffs "how to build the program if given the result"
2) Apply rDiffs to resultDiffs - merging diffs as needed.

rDiffs = hDiffsToRDiffs(prog, hDiffs)
progDiffs = applyRDiffs(rDiffs, resultDiffs)

Voilà ! Let's do it on a minimalistic language.
*/

DType = { Update: "Update", Merge: "Merge"}
DUType = { Reuse: "Reuse", New: "New"}
cons = function(x, y) { return {hd: x, tl: y} }
idPath = {up: 0, down: undefined}
List = { reverse: function reverse(x, acc) {
    if(typeof x === "undefined") return acc;
    return reverse(x.tl, cons(x.hd, acc));
  },
  length: function length(x) {
    if(typeof x === "undefined") return 0;
    return 1 + length(x.tl);
  },
  drop: function drop(n, x) {
    if(n <= 0 || typeof x === "undefined") return x;
    return drop(n - 1, x.tl);
  },
  fromArray: function(x) {
    let result = undefined;
    for(let i = x.length - 1; i >= 0; i--) {
      result = cons(x[i], result);
    }
    return result;
  },
  toArray: function(x) {
    let result = [];
    while(x) {
      result.push(x.hd); x = x.tl;
    }
    return result;
  },
  map: function map(f, x) {
    if(typeof x === "undefined") return undefined;
    return cons(f(x.hd), map(f, x.tl));
  },
  join: function(sep, x) {
    if(typeof x === "undefined") return "";
    result = x.hd;
    tl = x.tl;
    while(tl) { result += sep + tl.hd; tl = tl.tl}
    return result;
  }
}
flatMap = function(array, fun) {
  let result = [];
  for(let x of array) {
    let intermediate = fun(x);
    Array.prototype.push.apply(result, intermediate);
  }
  return result;
}

function composeRelativePaths(p1, p2) {
  let dRev = List.reverse(p1.down);
  let p1downLength = List.length(dRev);
  if(p1downLength > p2.up) {
    return {up: p1.up, down: List.reverse(List.drop(p2.up, dRev), p2.down)}
  } else {
    return {up: p1.up + (p2.up - p1downLength),
      down: p2.down}
  }
}
function composeStackPath(absoluteStack, relativePath) {
  let u = relativePath.up;
  while(u) {
    absoluteStack = absoluteStack.tl;
    u--;
  }
  let d = relativePath.down;
  while(d) {
    absoluteStack = cons(d.hd, absoluteStack);
    d = d.tl;
  }
  return absoluteStack;
}

function debugLog(msg, value) {
  console.log(msg);
  inspect(value);
  return value;
}
function normalizePath(path, args) {
  return typeof path === "string" ?
       {up: 0, down: cons(path, List.drop(1, List.fromArray(args)))} : 
       Array.isArray(path) ?
       {up: 0, down: List.fromArray(path)} :
       typeof path === "object" && typeof path.down === "string" ?
       {up: path.up || 0, down: cons(path.down)} :
       typeof path === "object" && typeof path.hd === "string" ?
       {up: 0, down: path} :
       typeof path === "number" && typeof args === "object" ?
         Array.isArray(args[1]) ? {up: path, down: List.fromArray(args[1])} : 
           {up: path, down: List.drop(1, List.fromArray(args))} :
       path || idPath;
}
// path(), path("field"), path("field", "subfield"), path(2), path(2, "field", "subfield"), path(["field", "subfield"]),
// path(2, ["field", "subfield"])
path = function(p) { return normalizePath(p, arguments); }

diffToString = function(depth, options) {
  if(this.ctor === DType.Update) {
    let children = () => {
      let childrenStr = "";
      for(let k in this.childDiffs) {
        childrenStr += (childrenStr.length == 0 ? "" : ",\n") + k + ": " +
          util.inspect(this.childDiffs[k]).replace(/\n/g, `\n${' '.repeat(k.length + 2)}`);
      }
      childrenStr += " }";
      return childrenStr;
    }
    if(this.kind.ctor === "Reuse") {
      if(noChildDiffs(this)) {// Pure clones
        if(isIdPath(this.kind.path)) return "DSame";
        return ("DClone(" +
          (this.kind.path.up === 0 ?
          List.join(",", List.map(x => util.inspect(x, {depth: undefined, colors: false}), this.kind.path.down)) :
          List.join(", ", cons(this.kind.path.up + "", List.map(x => util.inspect(x, {depth: undefined, colors: false}), this.kind.path.down))))
        +")");
      } else {
        let pathStr =
          this.kind.path.up !== 0 ?
            ", " + util.inspect(this.kind.path, {depth: undefined})
            : typeof this.kind.path.down === "undefined" ?
              "" :
              typeof this.kind.path.down.tl === "undefined" ? 
                ", " + util.inspect(this.kind.path.down.hd) :
                ", " + util.inspect(List.toArray(this.kind.path.down), {depth: undefined});

        let prefix  = "DUpdate({ ";
        let padding = "          ";
        return (prefix +  children().replace(/\n/g, `\n${padding}`)
          + pathStr + ")");
      }
    } else { // New
      let str =     "DNew(";
      let padding = "     ";
      str += util.inspect(this.kind.model).replace(/\n/g, `\n${padding}`)
      if(!noChildDiffs(this)) {
        str += ",\n" + padding + children();
      }
      str += ")";
      return str;
    }
  }
  return "Update";
}


isIdPath = function(path) {
  return path.up === 0 && path.down === undefined;
}
isDSame = function(diff) {
  if(diff.ctor == DType.Update && diff.kind.ctor == DUType.Reuse) {
    if(isIdPath(diff.kind.path)) {
      if(Object.keys(diff.childDiffs).length === 0) return true;
    }
  }
  return false;
}

HUpdate = DUpdate = function(childDiffs, path) {
  let cd = {};
  path = normalizePath(path);
  let outsideLevel = path.up;
  for(let k in childDiffs) {
    let child = childDiffs[k]
    if(Array.isArray(child)) {
      if(child.length != 1 || !isDSame(child[0])) {
        cd[k] = child;
        for(let c of child) {
          outsideLevel = Math.max((c.outsideLevel || 0) - 1, outsideLevel)
        }
      }
    } else {
      if(!isDSame(child)) {
        cd[k] = child;
        outsideLevel = Math.max((child.outsideLevel || 0) - 1, outsideLevel);
      }
    }
  }
  return { ctor: DType.Update, kind: { ctor: DUType.Reuse, path: path}, childDiffs: cd,
    [util.inspect.custom]: diffToString, outsideLevel: outsideLevel
  };
}

HClone = DClone = function(path) { return DUpdate({}, normalizePath(path, arguments)); }

HCloneUpdate = DCloneUpdate = function(path, childDiffs) { return DUpdate(childDiffs, path); }

DDClone = function(path) {
  return [DClone(path)];
}

HSame = DSame = DClone(idPath);
DDSame = [DSame]

DDUpdate = function(childDiffs, path) {
  return [DUpdate(childDiffs, path)];
}

HNew = DNew = function(model, childDiffs) {
  let outsideLevel = 0;
  for(let k in childDiffs) {
    let child = childDiffs[k];
    if(Array.isArray(child)) {
      for(let c of child) {
        outsideLevel = Math.max((c.outsideLevel || 0), outsideLevel);
      }
    } else {
      outsideLevel = Math.max(child.outsideLevel || 0, outsideLevel);
    }
  }
  return {ctor: DType.Update, kind: {ctor: DUType.New, model: model}, childDiffs: childDiffs || {},
  [util.inspect.custom]: diffToString, outsideLevel};
}

DDNew = RDNew = function(model, childDiffs) {
  return [HNew(model, childDiffs)];
}

function walk(path, prog, ctx) {
  let n = path.up;
  while(n) {
    prog = ctx.hd;
    ctx = ctx.tl;
    n--;
  }
  let d = path.down;
  while(d) {
    ctx = cons(prog, ctx);
    prog = prog[d.hd];
    d = d.tl;
  }
  return [prog, ctx];
}
function walkHDiff(path, hDiff, hDiffPathStack, hDiffContext) {
  let n = path.up;
  while(n) {
    hDiff = hDiffContext.hd;
    hDiffContext = hDiffContext.tl;
    if(hDiff.kind.ctor === DUType.Reuse) {
      hDiffPathStack = hDiffPathStack.tl;
    }
    n--;
  }
  let d = path.down;
  while(d) {
    hDiffContext = cons(hDiff, hDiffContext);
    if(hDiff.kind.ctor === DUType.Reuse) {
      hDiffPathStack = cons(d.hd, hDiffPathStack);
    }
    let newHDiffs = hDiff.childDiffs[d.hd];
    if(typeof newHDiffs === "undefined") {
      if(hDiff.kind.ctor === DUType.Reuse) {
        newHDiffs = HSame;
      } else {
        console.log(d)
        console.log(hDiff)
        console.log(hDiffContext);
        throw "Walking hDiff not consistent"
      }
    }
    hDiff = newHDiffs;
    d = d.tl;
  }
  return [hDiff, hDiffPathStack, hDiffContext];
}

// Applies the hDiffs to the given program.
function applyHDiffs(hDiff, prog) {
  function aux(hDiff, prog, ctx) {
    let kind = hDiff.kind;
    let isNew = kind.ctor === DUType.New;
    if(!isNew) {
      [prog, ctx] = walk(kind.path, prog, ctx);
    }
    let model = isNew ? kind.model : prog;
    let childDiffs = hDiff.childDiffs;
    if(Object.keys(childDiffs).length == 0) {
      return model;
    }
    let o = Array.isArray(model) ? [] : {};
    for(let k in model) {
      o[k] = model[k];
    }
    for(let k in childDiffs) {
      o[k] = aux(childDiffs[k],
         isNew ? prog : prog[k],
         isNew ? ctx : cons(prog, ctx));
    }
    return o;
  }
  return aux(hDiff, prog, undefined);
}



// Applies the dDiffs to the given program, taking the first diff into account if there are multiple
// If "last" is provided, it will fetch the last diff instead
function applyDDiffs(dDiff, prog, last) {
  function aux(dDiff, prog, ctx) {
    //console.log("aux"); inspect(dDiff); inspect(prog);
    let kind = dDiff.kind;
    let isNew = kind.ctor === DUType.New;
    if(!isNew) {
      [prog, ctx] = walk(kind.path, prog, ctx);
    }
    let model = isNew ? kind.model : prog;
    let childDiffs = dDiff.childDiffs;
    if(Object.keys(childDiffs).length == 0) {
      return model;
    }
    let o = Array.isArray(model) ? [] : {};
    for(let k in model) {
      o[k] = model[k];
    }
    for(let k in childDiffs) {
      o[k] = aux(last ? childDiffs[k][childDiffs[k].length - 1]: childDiffs[k][0],
         isNew ? prog : prog[k],
         isNew ? ctx : cons(prog, ctx));
    }
    return o;
  }
  return aux(last ? dDiff[dDiff.length - 1] : dDiff[0], prog, undefined);
}

// Returns RDiffs.
function reverseHDiffs(prog, hDiff) {
  function aux(prog, ctx, hDiff) {
    if(hDiff.kind.ctor == DUType.Reuse) {
      // If there is no cloning path, in reverse, it's also going to be a reuse.
      if(!isIdPath(hDiff.kind.path)) {
        [prog, ctx] = walk(hDiff.kind.path, prog, ctx);
      }
        
        // Here we need to rebuild the program.
      // Only difference is that un
    } else {
      
    }
  }
  return aux(prog, undefined, hDiff);
}

// Returns new dDiffs
function applyRDiffs(hDiff, rDiff, dDiffs) {
  function aux(rDiff, dDiffs, ctx) {
    let kind = rDiff.kind;
    let isNew = kind.ctor === DUType.New;
    // elements in model are actually unchanged from the beginning.
    // elements in chilDiffs are actually updates.
    
    //console.log("aux"); inspect(dDiff); inspect(prog);
    function oneDiff(dDiff, ctx) {
      if(dDiff.kind.ctor == DUType.Reuse) {
        if(Object.keys(dDiff.childDiffs).length === 0) { // pure clone
          let path = dDiff.kind.path;
          // We look for where this path would be cloned in the rDiff.
          
        }
      }
      if(!isNew) {
        [prog, ctx] = walk(kind.path, prog, ctx);
      }
      let model = isNew ? kind.model : prog;
      let childDiffs = dDiff.childDiffs;
      if(Object.keys(childDiffs).length == 0) {
        return model;
      }
      let o = Array.isArray(model) ? [] : {};
      for(let k in model) {
        o[k] = model[k];
      }
      for(let k in childDiffs) {
        o[k] = aux(last ? childDiffs[k][childDiffs[k].length - 1]: childDiffs[k][0],
           isNew ? prog : prog[k],
           isNew ? ctx : cons(prog, ctx));
      }
      return o;
    }
    return oneDiff(dDiffs[0], ctx);
  }
  return aux(rDiffs, dDiffs, undefined);
}

function noChildDiffs(diff) {
  return Object.keys(diff.childDiffs).length === 0
}

// Merge two "concurrent" DDiffs.
// Very light version
function merge2DDiffs(dDiff1, dDiff2) {
  if(debugMagicFunction) {
    console.log("merge2DDiffs")
    inspect(dDiff1)
    inspect(dDiff2)
  }
  let result = [];
  for(let diff1 of !Array.isArray(dDiff1) ? [dDiff1] : dDiff1) {
    for(let diff2 of !Array.isArray(dDiff2) ? [dDiff2] : dDiff2) {
      if(diff1.kind.ctor == DUType.New && diff2.kind.ctor == DUType.New) {
        if(typeof diff1.kind.model === "number" && typeof diff2.kind.model === "number") {
          result.push(DNew((diff1.kind.model + diff2.kind.model) / 2));
          continue;
        }
      }
      if(diff1.kind.ctor == DUType.Reuse && isIdPath(diff1.kind.path)) {
        if(diff2.kind.ctor == DUType.Reuse && isIdPath(diff2.kind.path)) {
          let finalChildDiffs = {};
          for(let k in diff1.childDiffs) {
            if(k in diff2.childDiffs) {
              finalChildDiffs[k] = merge2DDiffs(diff1.childDiffs[k], diff2.childDiffs[k]);
            } else {
              finalChildDiffs[k] = diff1.childDiffs[k];
            }
          }
          for(let k in diff2.childDiffs) {
            if(!(k in diff1.childDiffs)) {
              finalChildDiffs[k] = diff2.childDiffs[k];
            }
          }
          result.push(DUpdate(finalChildDiffs));
          continue;
        }
      }
    }
  }
  if(!Array.isArray(dDiff1) && !Array.isArray(dDiff2)) {
    if(result.length >= 1) {
      return result[0];
    } else {
      console.log("Problem merging two Diff, got empty result")
      inspect(dDiff1)
      inspect(dDiff2)
      console.log("returning second only")
      return dDiff2;
    }
  }
  return result;
}
function mergeDDiffs(dDiffs, single) {
  if(dDiffs.length === 0) return single ? DSame : DDSame;
  let result = dDiffs[0];
  for(let i = 1; i < dDiffs.length; i++) {
    result = merge2DDiffs(result, dDiffs[i]);
  }
  return result;
}

// Special case when the first one is a pure clone
// TODO: General case.
function andThen(dDiff1, dDiff2) {
  let result = [];
  for(let d1 of Array.isArray(dDiff1) ? dDiff1 : [dDiff1]) {
    for(let d2 of Array.isArray(dDiff2) ? dDiff2 : [dDiff2]) {
      if(d1.kind.ctor === DUType.Reuse && noChildDiffs(d1)) {
        if(d2.kind.ctor === DUType.Reuse) {
          result.push(DUpdate(d2.childDiffs, composeRelativePaths(d1.kind.path, d2.kind.path)));
        } else {
          let newChildDiffs = {};
          for(let k of d2.childDiffs) {
            newChildDiffs[k] = andThen(d1, d2.childDiffs[k]);
          }
          result.push(DNew(d2.kind.model, newChildDiffs));
        }
      }
    }
  }
  return !Array.isArray(dDiff1) && !Array.isArray(dDiff2) ? result[0] : result;
}

function foreach(obj) { return callback => {
    let result = [];
    for(let k in obj) {
      result.push(callback(k, obj[k]));
    }
    return result;
  }
}

// Transforms a conjunction of disjunctions of conjunctions to a disjunction of conjunctions.
function cdc_to_dc(listListList) {
  if(listListList.length === 0) return [[]];
  if(listListList.length === 1) return listListList[0];
  let firstDc = listListList[0];
  let seconDc = cdc_to_dc(listListList.slice(1));
  // Let's distribute!
  let resultDc = [];
  for(let c1 of firstDc) {
    for(let c2 of seconDc) {
      resultDc.push(c1.concat(c2));
    }
  }
  return resultDc;
}

/*function clabeldc_to_dclabel(listLabelListList) {
  if(listLabelListList.length === 0) return [[]];
  if(listLabelListList.length === 1) return listLabelListList[0];
  let {label: firstlabelDc = listLabelListList[0];
  let seconlabelDc = clabeldc_to_label_dc(listLabelListList.slice(1));
  // Let's distribute!
  let resultDc = [];
  for(let c1 of firstlabelDc) {
    
    for(let c2 of seconlabelDc) {
      resultDc.push(c1.concat(c2));
    }
  }
  return resultDc;
}*/

// Returns a stackPath matching where this stack path comes from in the original source tree.
// If it did not exist or is a New of something, return {error: msg}
function followStackPath(hDiff, stackPath) {
  let hPathStack = undefined;
  let path = List.reverse(stackPath);
  while(path) {
    let hd = path.hd;
    if(hDiff.kind.ctor === DUType.Reuse) {
      let p = hDiff.kind.path;
      hPathStack = cons(hd, composeStackPath(hPathStack, p));
      hDiff = hDiff.childDiffs[hd];
      if(typeof hDiff === "undefined") hDiff = HSame;
    } else {
      hDiff = hDiff.childDiffs[hd];
      if(typeof hDiff === "undefined") return {error: "Can't go down a HNew that does not reference '" + hd + "'"};
    }
    path = path.tl;
  }
  return hDiff && hDiff.kind.ctor === DUType.Reuse ?
     composeStackPath(hPathStack, hDiff.kind.path) :
     hPathStack;
}

// Like followStackPath but returns {ctor: "Just", _0: ...} if there is an original pathStack in hDiff
// which ends with no hDiffs at all. Else, return { ctor: "Nothing" }
function isDirectStackPath(hDiff, stackPath) {
  let hPathStack = undefined;
  let path = List.reverse(stackPath);
  while(path) {
    let hd = path.hd;
    if(hDiff.kind.ctor === DUType.Reuse) {
      let p = hDiff.kind.path;
      hPathStack = cons(hd, composeStackPath(hPathStack, p));
      hDiff = hDiff.childDiffs[hd];
      if(typeof hDiff === "undefined") {
        return {ctor: "Just", _0: List.reverse(path.tl, hPathStack)}
      }
    } else {
      hDiff = hDiff.childDiffs[hd];
      if(typeof hDiff === "undefined") return {ctor: "Nothing"};
    }
    path = path.tl;
  }
  return { ctor: "Nothing" };
}

function makeRelative(stackPath, stackPath2) {
  let absPath = List.reverse(stackPath), absPath2 = List.reverse(stackPath2);
  while(typeof absPath !== "undefined" && typeof absPath2 !== "undefined" && absPath.hd === absPath2.hd) {
    absPath = absPath.tl;
    absPath2 = absPath2.tl;
  }
  return {up: List.length(absPath), down: absPath2};
}

function DUpdatePath(stackPath, diff) {
  while(stackPath) {
    diff = DUpdate({[stackPath.hd]: diff});
    stackPath = stackPath.tl;
  }
  return diff;
}

function DDUpdatePath(stackPath, ddiff) {
  while(stackPath) {
    ddiff = [DDUpdate({[stackPath.hd]: ddiff})];
    stackPath = stackPath.tl;
  }
  return ddiff;
}

// Given a Diff, extracts any subdiff starting with the path in its own diff;
// if path = prefixPath + x, return an afterSourcePath of DUpdatePath(x, Clone | New), else return the diff as outsideSourcePath
// Return [relative diffs, absolute diffs];
function partitionAndMakeRelative(path, diff) {
  console.log("partitionAndMakeRelative");
  inspect(path);
  inspect(diff);
  if(typeof path === "undefined") {
    return inspect([diff, DSame]); // Everything is relative, but no need to relativize.
  }
  let head = path.hd;
  let tail = path.tl;
 
  if(diff.kind.ctor === DUType.Reuse && isIdPath(diff.kind.path)) {
    let absoluteChildDiffs = {};
    let rcd = DSame;
    let acd = DSame;
    for(let k in diff.childDiffs) {
      let c = diff.childDiffs[k];
      [rcd, acd] = k === head ?
          partitionAndMakeRelative(tail, c)
          : [rcd, c];
      if(!isDSame(acd)) {
        absoluteChildDiffs[k] = osp;
      }
    }
    return inspect([rcd, DUpdate(absoluteChildDiffs)])  ;
  } else {
    return inspect([DSame, diff]);
  }
}

function partitionAndMakeRelative2(path, diffs, stackPath) {
  function one(diff) {
    if(diff.kind.ctor === DUType.Reuse && isIdPath(diff.kind.path)) {
      return foreach(diff.childDiffs)((k, d) =>
        k === path.hd ?
          partitionAndMakeRelative2(path.tail, d, cons(k, stackPath)) :
          [[], DUpdatePath(stackPath, d)])
    }
  }
}

function flatten(arrayOfArrays) {
  let result = [];
  for(let elems of arrayOfArrays) result.push(...elems);
  return result;
}

// A stack path is like a path but in reverse, which makes it easier to add new path elements.

// Returns a Diff
function magicFunctionAux(hDiff, dDiff, dStackPath) {
  console.log("magicFunctionAux")
  inspect(hDiff)
  inspect(dDiff)
  inspect(List.toArray(dStackPath));
  // START: Optimization for closed diffs.
  if(dDiff.outsideLevel === 0) {
    let res = isDirectStackPath(hDiff, dStackPath);
    if(res.ctor === "Just") { // It's at the leaf of an HDiff.
      return inspectReturn(DUpdatePath(res._0, dDiff));
    }
  }
  // END: Optimization for closed diffs.
  let childDiffs = dDiff.childDiffs;
  if(dDiff.kind.ctor === DUType.Reuse) {
    let relPath = dDiff.kind.path;
    if(isIdPath(relPath))
      return inspectReturn(mergeDDiffs(foreach(childDiffs)((k, d) => magicFunctionAux(hDiff, d, cons(k, dStackPath)))));
    // On the output, at the current location pointed by dStackPath (the workplace),
    // we replace the existing element by a clone of a tree element present elsewhere in the output (the source).
    // The workplace's stack path is dStackPath
    let sourceStackPath      = composeStackPath(dStackPath, relPath); // The source's stack path is dStackPath + relPath.
    // By following the output's stack paths in the hDiff, we can recover the paths they come from in the input.
    let dPathOriginal        = followStackPath(hDiff, dStackPath); // Path where the workplace came from in the input.
    let dSourcePathOriginal  = followStackPath(hDiff, sourceStackPath); // Path where the source came from in the input.
    let clonePath            = makeRelative(dPathOriginal, dSourcePathOriginal); // Relative path between input's workplace and input's source.
    console.log("revworkplace-output")
    inspect(dStackPath)
    console.log("revsource   -output")
    inspect(sourceStackPath)
    console.log("revworkplace-input (dPathOriginal)")
    inspect(dPathOriginal)
    console.log("revsource   -input (dSourcePathOriginal)")
    inspect(dSourcePathOriginal)
    console.log("clonePath indicating source from workplace in input")
    inspect(clonePath);
    
    // We recover all children diffs globally as if they were done on the source's path.
    let diffsFromChildren = mergeDDiffs(foreach(childDiffs)((k, d) =>
      magicFunctionAux(hDiff, d, cons(k, sourceStackPath))), "single");
    console.log("diffsFromChildren");
    inspect(diffsFromChildren);
    // We now have a list of global differences made on the original input;
    // If these differences consists of updates whose path contains the prefix "dSourcePathOriginal", we assume that they happen on the workplace in the input and were cloned from the source in the input.
    console.log("dSourcePathOriginal - reminder");
    inspect(dSourcePathOriginal);
    let [relDiff, absDiff] = partitionAndMakeRelative(List.reverse(dSourcePathOriginal), diffsFromChildren);
    console.log("[relDiff, absDiff]");
    inspect([relDiff, absDiff]);
    
    let cloneAndDiff = andThen(DCloneUpdate(clonePath), relDiff);
    console.log("cloneAndDiff")
    inspect(cloneAndDiff)
    
    return inspectReturn(merge2DDiffs(DUpdatePath(dPathOriginal, cloneAndDiff), absDiff));
  } else {
    let dPathOriginal        = followStackPath(hDiff, dStackPath); // Path where the workplace came from in the input.
    if(noChildDiffs(dDiff))
      return DUpdatePath(dPathOriginal, dDiff);
    let newChildDiffs = {};
    // We collect absolute differences (outisde of the original path were we apply differences)
    let diffsFromChildren = mergeDDiffs(foreach(childDiffs)((k, d) => {
      let cd = magicFunctionAux(hDiff, d, dStackPath);
      let [relDiff, absDiff] = partitionAndMakeRelative(List.reverse(dPathORiginal), cd);
      newChildDiffs[k] = relDiff;
      return absDiff;
    }));
    return inspectReturn(merge2DDiffs(DUpdatePath(dPathOriginal, DNew(dDiff.kind.model, newChildDiffs)), diffsFromChildren));
  }    
}

// Returns a (disjunction) list of (conjunction) list of diffs, where each second level should be merged to get a single diff.
function magicFunctionAux2(hDiff, dDiffs, dPath) {
  return flatMap(dDiffs)(dDiff => {
    let childDiffs = dDiffs.childDiffs;
    if(dDiff.kind.ctor === DUType.Reuse) {
      let path = dDiff.kind.path;
      if(isIdPath(path))
        return cdc_to_dc(foreach(childDiffs)((k, d) =>
           magicFunctionAux2(hDiff, d, cons(k, dPath))));
      // let's compute where we are cloning from
      let sourceStackPath = composeStackPath(dPath, path);
      let dPathOriginal = followStackPath(hDiff, dPath);
      let dSourcePathOriginal = followStackPath(hDiff, sourceStackPath);
      let clonePath = makeRelative(dPathOriginal, sourcePathOriginal);
      let newChildDiffsToMerge = cdc_to_dc(foreach(childDiffs)((k, d) =>
        magicFunctionAux2(hDiff, d, cons(k, sourceStackPath))));
      return newChildDiffsToMerge.map(c => {
        let [afterSourcePath, outsideSourcePath] = partitionAndMakeRelative2(List.reverse(sourceStackPath), c);
        return
          [DUpdatePath(dPathOriginal, DClone(clonePath, mergeDDiffs(afterSourcePath)))].concat(
            outsideSourcePath
          );
      })
    } else { // dDiff.kind.ctor === DUType.New
      let dPathOriginal = followStackPath(hDiff, dPath);
      if(noChildDiffs(dDiffs))
        return [DDUpdatePath(dPathOriginal, DDNew(dDiff.kind.model))];
      console.log("unsafe zone, crashes will occur. Try to clone, not create from scratch for now");
      let newChildDiffsToMerge = clabeldc_to_dclabel(foreach (childDiffs)((k, d) =>
         ({label: k, result: magicFunctionAux2(hDiff, d, dPath)})));
      // : Conjunction of {label: String, result: Disjunction of Conjunction}; // cdc_to_dc()
      return newChildDiffsToMerge.map(c => {
        let [labelAfterSourcePath, outsideSourcePathDiffs] =
              partitionAndMakeRelativeLabel(dPath, c); // Careful, c elements contain a label.
        return [DUpdatePath(dPathOriginal, DDNew(model, mergeLabelDiffs(labelAfterSourcePath)))].concat(outsideSourcePathDiffs)
      })
    }
  });
}

debugMagicFunction = true;
// Returns progDiffs
function magicFunction(hDiff, resultDiffs, hDiffContext, hDiffPathStack, resultPath) {
  if(debugMagicFunction) {
    console.log("magicFunction")
    inspect(hDiff);
    inspect(resultDiffs);
    inspect(List.toArray(hDiffContext));
    inspect(List.toArray(List.reverse(hDiffPathStack)));
    inspect(List.toArray(resultPath));
  }
  let postProcess = function(result) {
    // Recreate the hDiffPathStack above it.
    let x = hDiffPathStack;
    while(x) {
      result = DDUpdate({[x.hd]: result});
      x = x.tl;
    }
    return result;
  }
  if(hDiff.kind.ctor === DUType.Reuse) {
    if(!isIdPath(hDiff.kind.path)) { // Process the clone first
      // TODO: Reverse paths by default?
      let newHDiffPathStack = composeStackPath(hDiffPathStack, hDiff.kind.path)
      if(debugMagicFunction) {
        console.log("magicFunction clone hDiffs", newHDiffPathStack)
      }
      let result = magicFunction(HUpdate(hDiff.childDiffs),
        resultDiffs, hDiffContext, newHDiffPathStack, resultPath);
      if(debugMagicFunction) {
        console.log("returning 1")
        inspect(result);
      }
      return result;
    } else if(noChildDiffs(hDiff)) { 
      if(debugMagicFunction) {
        console.log("returning 2")
        inspect(resultDiffs);
      }
      return postProcess(resultDiffs); // No change, it's the identity
    }
    // No clone but children, we can destructure.
  }
  let oneResultDiff = function(resultDiff) {
    if(resultDiff.kind.ctor === DUType.Reuse)  {
      if(!isIdPath(resultDiff.kind.path)) {
        let pathInHDiffs = resultDiff.kind.path;
        /*composeRelativePaths({up: 0, down: resultPath}, 
        resultDiff.kind.path);*/
        [hDiff, hDiffPathStack, hDiffContext] = walkHDiff(pathInHDiffs, hDiff, hDiffPathStack, hDiffContext);
        // The resulting hDiff tells where this resultDiff will be applied on the original element.
        if(debugMagicFunction) console.log("clone DDiffs", hDiff);
         /*let afterClonePath = idPath;
        if(hDiff.kind.ctor == DUType.Reuse) {
          afterClonePath = composeRelativePaths({up: 0, down: List.reverse(hDiffPathStack)}, hDiff.kind.path);
            hDiff.kind.path;
          if(debugMagicFunction) {
            console.log("afterClonePath");
            inspect({up: afterClonePath.up, down: List.toArray(afterClonePath.down)});
          }
          hDiff = DUpdate(hDiff.childDiffs, idPath); // the path in hDiff was taken into account.
        } else { // New
          console.log("TODO: New here")
        }*/
        let result = magicFunction(hDiff, DDUpdate(resultDiff.childDiffs), hDiffContext, hDiffPathStack, resultPath);
        /*if(!isIdPath(afterClonePath)) {
          if(debugMagicFunction) {
            console.log("returning after DDClone -- before adding path")
            inspect(result);
          }
          result = result.map(d =>
            DUpdate(d.childDiffs, composeRelativePaths(afterClonePath, d.kind.path))
          )
        }*/
        result = andThen(DDClone(resultDiff.kind.path), result)
        
        if(debugMagicFunction) {
          console.log("returning after DDClone")
          inspect(result);
        }
        return result;
      } else if(noChildDiffs(resultDiff)) {
        return DDSame;
      } else { // Further children
        let toMerge = [];
        for(let k in resultDiff.childDiffs) {
          [hDiff2, hDiffPathStack2, hDiffContext2] = walkHDiff({up: 0, down: cons(k)}, hDiff, hDiffPathStack, hDiffContext);
          if(debugMagicFunction) console.log("childDiff")
          let childDiff = magicFunction(hDiff2, resultDiff.childDiffs[k], hDiffContext2, hDiffPathStack2, List.reverse(cons(k, List.reverse(resultPath))));
          toMerge.push(childDiff);
        }
        let result = mergeDDiffs(toMerge);
        if(debugMagicFunction) {
          console.log("returning " + toMerge.length + " merged solutions")
          inspect(result);
        }
        return result;
      }
    } else {
      
    }
    return [];
  }
  let result = flatMap(resultDiffs, oneResultDiff);
  if(debugMagicFunction) {
    console.log("returning 3")
    inspect(result);
  }
  return result;
  /*let rDiffs = reverseHDiffs(prog, hDiffs);
  let progDiffs = applyRDiffs(rDiffs, resultDiffs);
  return progDiffs;*/
}

////// Tests

var ntests = 0; passedtests = 0;
function shouldEqual(a, b, msg) {
  ntests++;
  let as = uneval(a), bs = uneval(b);
  if(as !== bs) {
    console.log(msg || "Test failed");
    inspect(a)
    console.log("not equal to expected")
    inspect(b);
  } else passedtests++;
}

debugMagicFunction = false;
/*
shouldEqual(magicFunction(
   HClone("b"),
    DDNew(3)),
  DDUpdate({b: DDNew(3)}), "Clone new");

shouldEqual(magicFunction(
   HUpdate({d: HClone(1, "c")}, "b"),
    DDUpdate({d: DDNew(3)})),
  DDUpdate({b: DDUpdate({c: DDNew(3)})}))

shouldEqual(magicFunction(
   HUpdate({d: HClone(1, "c"), e: HClone(1, "c")}),
    DDUpdate({d: DDNew(3), e: DDNew(5)})),
  DDUpdate({c: DDNew(4)}));


shouldEqual(magicFunction(
   HUpdate({a: HClone(1, "b")}),
    DDClone("a")),
  DDClone("b"))

shouldEqual(magicFunction(
   HNew({}, {a: HClone("b"), b: HClone("b")}),
    DDClone("a")),
  DDClone("b"));

shouldEqual(magicFunction(
   HUpdate({a: HClone(1, "b")}),
    DDClone("b")),
  DDClone("b"));

shouldEqual(magicFunction(
   HUpdate({a: HClone(1, "b"), b: HClone(1, "a")}),
    DDClone("b")),
  DDClone("a"));

shouldEqual(magicFunction(
   HUpdate({a: HClone(1, "b")}),
    DDUpdate({a: DDNew(3)})),
  DDUpdate({b: DDNew(3)}));

shouldEqual(magicFunction(
   HNew({}, {d: HClone("a"), c: HClone("a"), b: HClone("b")}),
    DDUpdate({d: DDNew(3), c: DDNew(5)})),
  DDUpdate({a: DDNew(4)}));

shouldEqual(magicFunction(
   HNew({}, {a: HSame, b: HSame}),
    DDUpdate({a: DDNew(2)})),
  DDNew(2));

shouldEqual(magicFunction(
   HUpdate({
     b: HClone(2, "c")
   }, ["a"]),
    DDUpdate({
      b: DDNew(3)
    })),
  DDUpdate({
    c: DDNew(3)
  }));

debugMagicFunction = true;
shouldEqual(magicFunction(
   HUpdate({
      body: HUpdate({
        app: HUpdate({
          arg: HClone(5, "arg")
        }),
        arg: HClone(4, "arg")
      })
      }, {up: 0, down: cons("app", cons("body"))}),
    DDUpdate({body: DDUpdate({app: DDClone("app")}).concat(DDClone("app"))})),
  DDUpdate({
    app: DDUpdate({
      body: DDUpdate({
         body: DDUpdate({app: DDClone("app")}).concat(DDClone("app"))
       })
      })
    })
  );
*/
  
debugMagicFunction = true;
/*
//*/

shouldEqual(magicFunctionAux(
  HNew({}, {a: HNew({}, {b: HCloneUpdate({up: 0, down: cons("c")}, {d: HClone(2, "f")}) })}),
  DUpdate({a: DUpdate({b: DUpdate({d: DCloneUpdate({up: 1, down: cons("e")}, {p: DClone(2, "d")}), e: DClone(1, "d")})})})),
  DUpdate(
    {f: DCloneUpdate({up: 1, down: cons("c", cons("e"))}, {p: DClone(3, "f")}),
     c: DUpdate({e: DClone(2, "f")})
    }));

console.log(passedtests + "/" + ntests + " tests succeeded")
process.exit()


function doTest(testObject) {
  for(let testcase of testObject.testcases) {
    prog1 = testcase.prog1
    step1 = testObject.hEvaluate(prog1);
    console.log("\n\n-------\nFor program")
    inspect(prog1);
    console.log("Transformed through")
    inspect(step1);
    prog2 = applyHDiffs(step1, prog1);
    inspect(prog2);

    //let reverseStep1 = reverseHDiffs(prog1, step1);

    for(let prog2Diff of testcase.prog2diffs) {
      console.log("\nIf we change")
      inspect(prog2)
      console.log("by")
      inspect(prog2Diff);
      console.log("to")
      inspect(applyDDiffs(prog2Diff, prog2));
      console.log("then we change")
      inspect(prog1);
      let prog1Diff = magicFunction(step1, prog2Diff);
      console.log("by")
      inspect(prog1Diff);
      console.log("to")
      inspect(applyDDiffs(prog1Diff, prog1));
    }
  }
}

//--------------- Test with Rewrite lambda calculus ---------//

cbn_lambda_calculus = {
  // Prog = string
  //      | {lambda: name, body: Prog} 
  //      | {app: Prog, arg: Prog}
  testcases: [
    {prog1: {app: {lambda: "x", body: {lambda: "y", body: {app: {app: "y", arg: "x"}, arg: "x" } }}, arg: "z"},
      prog2diffs: [
        // Remove first argument, or remove second argument.
        DDUpdate({body: DDUpdate({app: DDClone("app")}).concat(DDClone("app"))}),
        // Replace second argument by w
        DDUpdate({body: DDUpdate({arg: DDNew("w")})}),
        // Replace First argument by w
        DDUpdate({body: DDUpdate({app: DDUpdate({arg: DDNew("w")})})}),
        // Copy function to overwrite second argument
        DDUpdate({body: DDUpdate({arg: DDClone(1, "app", "app")})}),
        // Add a third argument
        // Clone the second argument to a third argument z (should be x at the end) or add an unrelated third argument z (should stay z at the end)
        DDUpdate({body: DDNew({}, {app: DDSame, arg: DDClone("arg").concat(DDNew("z"))})})
      ]
    }
  ],
  hEvaluate(prog) {
    // Returns the hdiff to perform.
    if(typeof prog.lambda !== "undefined") return HSame;
    if(typeof prog === "string") return HSame;
    if(typeof prog.app.lambda === "undefined") // The function is not yet a lambda
      return HUpdate({app: hEvaluate(prog.app)});
    let name = prog.app.lambda;
    let evalHDiff = function(upDepth, bodyExp, cloneFrom) { // Replacement.
      if(bodyExp === name)            return HClone(upDepth, "arg"); // Clone of argument
      if(typeof bodyExp === "string") return HClone(cloneFrom); // Other name
      if(bodyExp.lambda === name)     return HClone(cloneFrom); //shadowing: don't touch
      if(typeof bodyExp.lambda !== "undefined") // Lambda with different name.
        return HUpdate({body: evalHDiff(upDepth+1, bodyExp.body)}, cloneFrom);
      //if(typeof bodyExp.app !== "undefined") {
      return HUpdate({
        app: evalHDiff(upDepth + 1, bodyExp.app),
        arg: evalHDiff(upDepth + 1, bodyExp.arg)
        }, cloneFrom);
    }
    return evalHDiff(2, prog.app.body, cons("app", cons("body")));
  }
}
doTest(cbn_lambda_calculus);

cbv_lambda_calculus = {
  // Prog = string
  //      | {lambda: name, body: Prog} 
  //      | {app: Prog, arg: Prog}
  testcases: [
    {prog1: {app: {lambda: "x", body: {lambda: "y", body: {app: {app: "y", arg: "x"}, arg: "x" } }}, arg: "z"},
      prog2diffs: [
        // Remove first argument, or remove second argument.
        DDUpdate({body: DDUpdate({app: DDClone("app")}).concat(DDClone("app"))}),
        // Replace second argument by w
        DDUpdate({body: DDUpdate({arg: DDNew("w")})}),
        // Replace First argument by w
        DDUpdate({body: DDUpdate({app: DDUpdate({arg: DDNew("w")})})}),
        // Copy function to overwrite second argument
        DDUpdate({body: DDUpdate({arg: DDClone(1, "app", "app")})}),
        // Add a third argument
        // Clone the second argument to a third argument z (should be x at the end) or add an unrelated third argument z (should stay z at the end)
        DDUpdate({body: DDNew({}, {app: DDSame, arg: DDClone("arg").concat(DDNew("z"))})})
      ]
    }
  ],
  hEvaluate(prog) {
    // Returns the hdiff to perform.
    if(typeof prog.lambda !== "undefined") return HSame;
    if(typeof prog === "string") return HSame;
    
    if(typeof prog.app.lambda === "undefined") // The function is not yet a lambda
        return HUpdate({app: hEvaluate(prog.app)});
    if(typeof prog.arg.lambda === "undefined") // The argument is not yet a lambda
        return HUpdate({arg: hEvaluate(prog.arg)});

    let name = prog.app.lambda;
    if(typeof prog.arg.lambda != "undefined") { // The argument is also a lambda now
      let evalHDiff = function(upDepth, bodyExp, cloneFrom) {
        if(bodyExp === name)            return HClone(upDepth, "arg"); // Clone of argument
        if(typeof bodyExp === "string") return HClone(cloneFrom) // Other variable
        if(bodyExp.lambda === name)     return HClone(cloneFrom); // Shadowing: don't touch
        if(typeof bodyExp.lambda !== "undefined")
          return HUpdate({
            body: evalHDiff(upDepth + 1, bodyExp.body)
          }, cloneFrom);
        //if(typeof bodyExp.app !== "undefined") {
        return HUpdate({
          app: evalHDiff(upDepth + 1, bodyExp.app),
          arg: evalHDiff(upDepth + 1, bodyExp.arg)
        }, cloneFrom);
      }
      return evalHDiff(2, prog.app.body, cons("app", cons("body")));
    }
  }
}

/*
cbneed_lambda_calculus = {
  // ProgState = {prog: Prog, indexCache: number, cache: {[key: number]: {lambda: name, body: Prog}}
  // Prog = {name: string}
  //      | {lambda: name, body: Prog}
  //      | {app: Prog, arg: Prog, computed?: number}
  testcases: [
    {prog1: {app: {lambda: "x", body: {lambda: "y", body: {app: {app: "y", arg: "x"}, arg: "x" } }}, arg: "z"},
      prog2diffs: [
        // Remove first argument, or remove second argument.
        DDUpdate({body: DDUpdate({app: DDClone("app")}).concat(DDClone("app"))}),
        // Replace second argument by w
        DDUpdate({body: DDUpdate({arg: DDNew("w")})}),
        // Replace First argument by w
        DDUpdate({body: DDUpdate({app: DDUpdate({arg: DDNew("w")})})}),
        // Copy function to overwrite second argument
        DDUpdate({body: DDUpdate({arg: DDClone(1, "app", "app")})}),
        // Add a third argument
        // Clone the second argument to a third argument z (should be x at the end) or add an unrelated third argument z (should stay z at the end)
        DDUpdate({body: DDNew({}, {app: DDSame, arg: DDClone("arg").concat(DDNew("z"))})})
      ]
    }
  ],
  hEvaluate(progState) {
    let prog = progState.prog;
    let cache = progState.cache;
    if(typeof prog.lambda !== "undefined") return HSame;
    if(typeof prog.name === "string") return HSame;
    if(typeof prog.computed !== "undefined") {
      let cached = cache[prog.computed];
      if(typeof cached !== "undefined") {
        return HUpdate({
          prog: HClone(1, "cache", prog.computed)})
      }
    }
    if(typeof prog.app.lambda === "undefined") { // The function is not yet a lambda
      let sub = hEvaluate({prog: prog.app, indexCache: progState.indexCache, cache: cache})
      
      HUpdate({prog: HUpdate({app: hEvaluate(prog.app)}));

    let name = prog.app.lambda;
    if(typeof prog.arg.lambda != "undefined") { // The argument is also a lambda now
      let evalHDiff = function(upDepth, bodyExp, cloneFrom) {
        if(bodyExp === name)            return HClone(upDepth, "arg"); // Clone of argument
        if(typeof bodyExp === "string") return HClone(cloneFrom) // Other variable
        if(bodyExp.lambda === name)     return HClone(cloneFrom); // Shadowing: don't touch
        if(typeof bodyExp.lambda !== "undefined")
          return HUpdate({
            body: evalHDiff(upDepth + 1, bodyExp.body)
          }, cloneFrom);
        //if(typeof bodyExp.app !== "undefined") {
        return HUpdate({
          app: evalHDiff(upDepth + 1, bodyExp.app),
          arg: evalHDiff(upDepth + 1, bodyExp.arg)
        }, cloneFrom);
      }
      return evalHDiff(2, prog.app.body, cons("app", cons("body")));
    }
  }
}
*/

//--------------- Test with Env-based CBN lambda calculus -------//

env_cbn_lambda_calculus = {
  // ProgState = {prog: Compute | Return, continuations: List {}}
  // Compute =      {ctor: "Compute", data: {env: Env, exp: Exp}}
  // Exp =  string
  //      | {lambda: string, body: Exp}
  //      | {app: Exp, arg: Exp}
  // Env = {name: String, value: {env: Env, exp: Exp}, tail: Env} | {}
  // Return = {ctor: "Return", data: {env: Env, exp: {lambda: string, body: Exp}}}
  continuations: {
    applyArg: function(progState) { // First element of continuations is an applyArg
      let val = progState.prog.data;
      let cont = progState.continuations.hd;
      return {prog:
          {ctor: "Compute",
            env: {name: val.exp.lambda, value: cont.data, tail: val.env},
            exp: val.exp.body},
        continuations: progState.continuations.tl}
    }
  },
  
  // Ground truth
  evaluate(progState) {
    let prog = progState.prog;
    if(prog.ctor === "Return") {
      if(typeof progState.continuations !== "undefined") {
        return continuations[progState.continuations.hd.ctor](progState);
      } else {
        return prog; // Final value.
      }
    }
    if(typeof prog.data.exp === "string") {
      let env = prog.data.env;
      while(env && env.name !== exp) env = env.tail;
      if(!env) { console.log(env); throw exp + " not found"; }
      return evaluate({prog: {ctor: "Compute", data: env.value}, // Replace data with env's data
                       continuations: progState.continuations});
    }
    if(typeof prog.data.exp.lambda === "string") {
      return evaluate({prog: {ctor: "Return", data: prog.data}, // Compute => Return
                       continuations: progState.continuations});
    }
    if(typeof prog.data.exp.app !== "undefined") {
      // Replace exp with exp.app
      // Add a continuations
      return evaluate({prog: {ctor: "Compute", data: {env: env, exp: prog.data.exp.app}},
                       continuations: cons({kind: "applyArg", data: {env: env, exp: prog.exp.arg}}, progState.continuations)});
    }
  },
  
  hContinuations: {
    applyArg(progState) { // First element of continuations is an applyArg. It used to be a Return
      return HUpdate({
        prog: HUpdate({
          ctor: HNew("Compute"),
          data: HUpdate({
            env: HNew({}, {
              name: HClone(1, "exp", "lambda"),
              value: HClone(3, "continuations", "hd", "data"),
              tail: HSame}),
            exp: HClone("body")})}),
        continuations: HClone("tl")
      })
    }
  },
  
  hEvaluate(progState) {
    let prog = progState.prog;
    if(prog.ctor === "Return")
      return typeof progState.continuations !== "undefined" ?
        hContinuations[progState.continuations.hd.ctor](progState)
        : HSame; // Final value.
    if(typeof prog.data.exp === "string") {
      let env = prog.data.env;
      let downStack = cons("value");
      while(env && env.name !== exp) {
        env = env.tail;
        downStack = cons("tail", downStack)
      }
      if(!env) { console.log(env); throw exp + " not found"; }
      return HUpdate({prog: HUpdate({data: HClone(cons("env", downStack))})});
    }
    if(typeof prog.data.exp.lambda === "string") {
      return HUpdate({prog: HUpdate({ctor: HNew("Return")})});
    }
    // if(typeof prog.data.exp.app !== "undefined") {
      // Replace exp with exp.app
      // Add a continuations
    return HUpdate({
      prog: HUpdate({
        data: HUpdate({
          exp: HClone("app")})}),
      continuations: HNew({}, {
        hd: HNew({kind: "applyArg"}, {
         data: HClone(1, "prog", "data")}),
        tl: HSame
      })});
  }
}

//--------------- Test with Env-based CBV lambda calculus -------//

env_cbv_lambda_calculus = {
  // ProgState = {prog: Compute | Return, continuations: List {}}
  // Compute =      {ctor: "Compute", data: {env: Env, exp: Exp}}
  // Exp =  string
  //      | {lambda: string, body: Exp}
  //      | {app: Exp, arg: Exp}
  // Env = {name: String, value: {env: Env, exp: Exp}, tail: Env} | {}
  // Return = {ctor: "Return", data: {env: Env, exp: {lambda: string, body: Exp}}}
  continuations: {
    computeArg(progState) { // First element of continuations is an computeArg, program is a Return.
      let computedFun = progState.prog.data;
      let argCompute = progState.continuations.hd; // The continuation is how to compute the argument
      return {
        prog:
          {ctor: "Compute",
           data: argCompute},
        continuations: {hd: {
          ctor: "applyFun", // Store the env/exp lambda for later.
          data: computedFun
        }, tl: progState.continuations.tl}}
    },
    applyFun(progState) { // First element of continuations is an applyFun, program is a Return (the argument).
      let computedFun = progState.continuations.hd.data;
      let argVal = progState.prog.data;
      return {
        prog:
          { ctor: "Compute",
            data: {
              exp: computedFun.exp.body,
              env: {name: computedFun.exp.lambda, value: argVal, tail: computedFun.env}
            }
          },
        continuations: progState.continuations.tl}
    }
  },
  
  evaluate: function evaluate(progState) {
    let prog = progState.prog;
    if(prog.ctor === "Return") {
      if(typeof progState.continuations !== "undefined") {
        return continuations[progState.continuations.hd.ctor](progState);
      } else {
        return prog; // Final value.
      }
    }
    if(typeof prog.data.exp === "string") {
      let env = prog.data.env;
      while(env && env.name !== exp) env = env.tail;
      if(!env) { console.log(env); throw exp + " not found"; }
      return evaluate({prog: {ctor: "Return", data: env.value}, // For CBV, data is a value=>"Return" instead of "Compute"
                       continuations: progState.continuations});
    }
    if(typeof prog.data.exp.lambda === "string") {
      return evaluate({prog: {ctor: "Return", data: prog.data}, // Compute => Return
                       continuations: progState.continuations});
    }
    if(typeof prog.data.exp.app !== "undefined") {
      // Replace exp with exp.app
      // Add a continuations
      return evaluate({prog: {ctor: "Compute", data: {env: env, exp: prog.data.exp.app}},
        continuations: cons({kind: "computeArg", data: {env: env, exp: prog.data.exp.arg}}, progState.continuations)});
    }
  },
  
  hContinuations: {
    computeArg(progState) { // First element of continuations is a computeArg, program is a Return.
      return HUpdate({
        prog: HUpdate({
          ctor: HNew("Compute"),
          data: HClone(2, "continuations", "hd")}),
        continuations: HNew({}, {
          hd: HNew({ctor: "applyFun"}, {
            data: HClone(1, "prog", "data")}),
          tl: HSame})});
    },
    applyFun(progState) { // First element of continuations is an applyFun, program is a Return (the argument).
      return HUpdate({
        prog: HUpdate({
          ctor: HNew("Compute"),
          data: HNew({}, {
            exp: HClone(2, "continuations", "hd", "data", "exp", "body"),
            env: HNew({}, {
              name: HClone(2, "continuations", "hd", "data", "exp", "lambda"),
              value: HSame})})}),
        continuations: HClone("tl")})
    }
  },
  
  hEvaluate(progState) {
    let prog = progState.prog;
    if(prog.ctor === "Return") {
      if(typeof progState.continuations !== "undefined") {
        return hContinuations[progState.continuations.hd.ctor](progState);
      } else {
        return HSame; // Final value, no change possible.
      }
    }
    if(typeof prog.data.exp === "string") {
      let env = prog.data.env;
      let downpath = cons("value");
      while(env && env.name !== exp) {
        env = env.tail;
        downpath = cons("tail", downpath)
      }
      if(!env) { console.log(env); throw exp + " not found"; }
      return HUpdate({
        prog: HUpdate({
          ctor: HNew("Return"), // For CBV, data is a value=>"Return" instead of "Compute"
          data: HClone(cons("env", downpath))})});
    }
    if(typeof prog.data.exp.lambda === "string") {
      return HUpdate({prog: HUpdate({ctor: HNew("Return")})}); // Compute => Return
    }
    if(typeof prog.data.exp.app !== "undefined") {
      // Replace exp with exp.app
      // Add a continuations
      return HUpdate({
        prog: HUpdate({data: HUpdate({exp: HClone("app")})}),
        continuations: HNew({}, {
          hd: HNew({kind: "computeArg", data: HCloneUpdate({up: 1, down: cons("prog", cons("data"))}, { exp: HClone("arg")})}),
          tl: HSame})});
    }
  }
}