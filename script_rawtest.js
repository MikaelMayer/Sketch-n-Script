var util = require('util');

var uneval = x => util.inspect(x, {depth: undefined, colors: true});

const inspect = function(what) {
  console.log(uneval(what));
  //console.dir(what, {depth: undefined});
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
  result = [];
  for(let x of array) {
    Array.prototype.push.apply(result, fun(x));
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
HSame = DSame = { ctor: DType.Update, kind: { ctor: DUType.Reuse, path: idPath}, childDiffs: {}};

DDSame = [DSame]

function debugLog(msg, value) {
  console.log(msg);
  inspect(value);
  return value;
}
function normalizePath(path, args) {
  return typeof path === "string" ?
       {up: 0, down: cons(path)} : 
       Array.isArray(path) ?
       {up: 0, down: List.fromArray(path)} :
       typeof path === "object" && typeof path.down === "string" ?
       {up: path.up || 0, down: cons(path.down)} :
       typeof path === "object" && typeof path.hd === "string" ?
       {up: 0, down: path} :
       typeof path === "number" && typeof args === "object" ? {up: path, down: List.drop(1, List.fromArray(args))} :
       path || idPath;
}

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
                ", " + util.inspect(this.kind.path.down.head) :
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

HClone = DClone = function(path) {
  return { ctor: DType.Update, kind: { ctor: DUType.Reuse, path: normalizePath(path, arguments)}, childDiffs: {},
  [util.inspect.custom]: diffToString};
}

DDClone = function(path) {
  return [DClone(path)];
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
  for(let k in childDiffs) {
    if(!isDSame(childDiffs[k])) {
      cd[k] = childDiffs[k]
    }
  }
  return { ctor: DType.Update, kind: { ctor: DUType.Reuse, path: normalizePath(path)}, childDiffs: cd,
  [util.inspect.custom]: diffToString }
}

DDUpdate = function(childDiffs, path) {
  return [HUpdate(childDiffs, path)];
}

HNew= DNew = function(model, childDiffs) {
  return {ctor: DType.Update, kind: {ctor: DUType.New, model: model}, childDiffs: childDiffs || {},
  [util.inspect.custom]: diffToString};
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
  for(let diff1 of dDiff1) {
    for(let diff2 of dDiff2) {
      if(diff1.kind.ctor == DUType.New && diff1.kind.ctor == DUType.New) {
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
  return result;
}
function mergeDDiffs(dDiffs) {
  if(dDiffs.length === 0) return [];
  let result = dDiffs[0];
  for(let i = 1; i < dDiffs.length; i++) {
    result = merge2DDiffs(result, dDiffs[i]);
  }
  return result;
}

debugMagicFunction = true;
// Returns progDiffs
function magicFunction(hDiff, resultDiffs, hDiffContext, hDiffPathStack, resultPath) {
  if(debugMagicFunction) {
    console.log("magicFunction")
    inspect(hDiff);
    inspect(resultDiffs);
    inspect(hDiffContext);
    inspect(hDiffPathStack);
    inspect(resultPath);
  }
  if(hDiff.kind.ctor === DUType.Reuse) {
    if(!isIdPath(hDiff.kind.path)) { // Process the clone first
      // TODO: Reverse paths by default?
      let absolutePath = composeRelativePaths({up: 0, down: List.reverse(hDiffPathStack)}, hDiff.kind.path);
      let rPathDown = List.reverse(absolutePath.down);
      if(debugMagicFunction) {
        console.log("magicFunction clone hDiffs")
      }
      let result = DDUpdate(
        {[rPathDown.hd]: magicFunction(HUpdate(hDiff.childDiffs, {up: 0, down: List.reverse(rPathDown.tl)}),
        resultDiffs, hDiffContext, hDiffPathStack, resultPath)
      });
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
      return resultDiffs; // No change, it's the identity
    }
    // No clone but children, we can destructure.
  }
  let oneResultDiff = function(resultDiff) {
    if(resultDiff.kind.ctor === DUType.Reuse)  {
      if(!isIdPath(resultDiff.kind.path)) {
        let pathInHDiffs = composeRelativePaths({up: 0, down: resultPath}, resultDiff.kind.path);
        [hDiff, hDiffPathStack, hDiffContext] = walkHDiff(pathInHDiffs, hDiff, hDiffPathStack, hDiffContext);
        // The resulting hDiff tells where this resultDiff will be applied on the original element.
        if(debugMagicFunction) console.log("clone DDiffs");
        let afterClonePath = idPath;
        if(hDiff.kind.ctor == DUType.Reuse) {
          afterClonePath = composeRelativePaths({up: 0, down: List.reverse(hDiffPathStack)}, hDiff.kind.path);
          if(debugMagicFunction) {
            console.log("afterClonePath");
            inspect(List.toArray(afterClonePath));
          }
          hDiff = DUpdate(hDiff.childDiffs, idPath); // the path in hDiff was taken into account.
        } else { // New
          console.log("TODO: New here")
        }
        let result = magicFunction(hDiff, DDUpdate(resultDiff.childDiffs, idPath), hDiffContext, hDiffPathStack, resultPath);
        if(!isIdPath(afterClonePath)) {
          if(debugMagicFunction) {
            console.log("returning after DDClone -- before adding path")
            inspect(result);
          }
          result = result.map(d =>
            DUpdate(d.childDiffs, composeRelativePaths(afterClonePath, d.kind.path))
          )
        }
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

debugMagicFunction = true;

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

/*shouldEqual(magicFunction(
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
  );*/

console.log(passedtests + "/" + ntests + " tests succeeded")
process.exit()


function doTest(testObject) {
  for(let testcase of testObject.testcases) {
    prog1 = testcase.prog1
    step1 = testObject.smallStep(prog1);
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

rewrite_lambda_calculus = {
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
  smallStep(prog) {
    // Returns the hdiff to perform.
    if(typeof prog.lambda !== "undefined" || typeof prog === "string") {
      console;log(prog);
      throw "no small step available"
    } else { // app.
      if(typeof prog.app.body != "undefined") {
        let name = prog.app.lambda;
        let evalHDiff = function(upDepth, bodyExp, cloneFrom) {
          if(bodyExp === name) { // Clone of argument
            return HClone(upDepth, "arg");
          }
          if(typeof bodyExp === "string" || bodyExp.lambda === name) { // Other name or shadowing: don't touch
            return HClone(cloneFrom);
          }
          if(typeof bodyExp.lambda !== "undefined") {
            return HUpdate({
              body: evalHDiff(upDepth + 1, bodyExp.body)
            }, cloneFrom);
          }
          if(typeof bodyExp.app !== "undefined") {
            return HUpdate({
              app: evalHDiff(upDepth + 1, bodyExp.app),
              arg: evalHDiff(upDepth + 1, bodyExp.arg)
            }, cloneFrom);
          }
        }
        let childDiffs = evalHDiff(2, prog.app.body, cons("app", cons("body")));
        return childDiffs;
      } else {
        return HUpdate({app: smallStep(prog.app)});
      }
    }
  }
}
doTest(rewrite_lambda_calculus);

//--------------- Test with Env-based CBN lambda calculus -------//

test2 = {
  // Prog = {env: Env, exp: Exp}
  // Exp =  {name: string}
  //      | {lambda: name, body: Exp} 
  //      | {app: Exp, arg: Exp}
  // Env = {name: String, value: Exp, tail: Env} | {}
}

//--------------- Test with Env-based CBV lambda calculus -------//

test3 = {
  // Prog = {env: Env, exp: Exp}
  // Exp =  {name: string}
  //      | {lambda: name, body: Exp} 
  //      | {app: Exp, arg: Exp}
  // Env = {name: String, value: {lambda: ...}, tail: Env} | {}
}
