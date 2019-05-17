import * as syntax from './syntax';
import * as Node from './nodes';
import * as esprima from './esprima';

type Ok<a> = { ctor: 'Ok', _0: a}
type Err<a> = { ctor: 'Err', _0: a}
type Res<err,ok> = Err<err> | Ok<ok> 
declare function Ok<a>(arg: a): Ok<a>;
declare function Err<a>(arg: a): Err<a>;
declare function resultCase<err,ok,a>(arg: Res<err,ok>, cb1: ((e: err) => a), cb2: ((o: ok) => a)): a;
type List<a> = undefined | { head: a, tail: List<a>}
declare var List: {
    drop: <a>(list: List<a>, k: number) => List<a>,
    reverseInsert: <a>(toInsert: List<a>, list: List<a>) => List<a>,
    length: <a>(list: List<a>) => number,
    toArray: (<a>(list: List<a>) => a[]), /* | (<a, b>(list: List<a>, map: (v: a) => b) => b[])*/
    fromArray: (<a>(arr: a[], tail?: List<a>) => List<a>),
    mkString: <a>(list: List<a>, callback: (elem: a, index?: number) => string) => string,
    builder: <a>() => { append: (a) => undefined, build: () => List<a> },
    concat: <a>(list1: List<a>, list2: List<a>) => List<a>
  }
declare function cons_<a>(arg: a, tail: List<a>): List<a>
declare function array_flatten<a>(arg: (a | undefined)[][]): a[]
declare function array_repeat<a>(arg: a, n: number): a[]
declare var arrayAll: <a>(arr: a[], callback: (arg: a, i: number) => boolean) => boolean

enum HeapValueType {
  Raw = "Raw",
  Array = "Array",
  Object = "Object",
  Function = "Function",
  Ref = "Ref"
}
type HeapLocation = string
type Heap = { [name: string]: Value };
enum ValueType {
  Raw = "Raw",
  Ref = "Ref",
  Fun = "Fun",
  Obj = "Obj",
  Arr = "Arr"
}

// When a value was computed, what led to computing it?
// Diffs for ComputationSource is always a Reuse specifying individual diffs for Env, expr and heap.
// In JS, the environment does not contain objects or arrays, only references.
type Value = 
  { ctor: ValueType.Raw, value: string | number | boolean | undefined | null } |
  { ctor: ValueType.Ref, name: string} |
  { ctor: ValueType.Obj, value: {[key: string]: Value}} |
  { ctor: ValueType.Arr, value: Value[]} |
  { ctor: ValueType.Fun, env: Env,
    funbody: Node.FunctionDeclaration | Node.FunctionExpression,
    this_?: string, // If the function's this is bound to something.
    refName?: string // If the function is associated with an object for some properties.
  }

type Env = List<{name: string, value: Value}>

enum ComputationType {
  //Argument = "Argument", // next argument to compute
  Call = "Call",     // 
  Assign = "Assign", // := in Caml
  MaybeDeref = "MaybeDeref",
  FunctionEnd = "FunctionEnd",
  //Primitive = "Primitive",
  Node = "Node" // When processed, before adding to stack, adds the env to the next NodeWithoutEnv in the stack.
}
type ComputationNode = { ctor: ComputationType.Node, env?: Env, node: AnyNode, returnedExpressionStatement?: boolean };
      // Returned mean that if the node is an expressionStatement, its value can be updated.
      // If the env is not there yet, it is added when the previous statement is processed.
type ComputationMaybeDeref = { ctor: ComputationType.MaybeDeref} // Dereferences the last element (e.g. to retrieve the value, not the reference)
type Computation = 
      ComputationNode
    | ComputationMaybeDeref
    | { ctor: ComputationType.Call, arity: Number}
    | { ctor: ComputationType.Assign} // Arity 2
    | { ctor: ComputationType.FunctionEnd} // Just a marker. If reached, pushes 'undefined' to the stack's values.

// Contains the stack of computed values, and computations yet to do.
type Stack = {values: List<Value>, computations: List<Computation>};

function initStack(env: Env, initNode: AnyNode): Stack {
  return {values: undefined, computations: {head: {ctor: ComputationType.Node, env: env, node: initNode}, tail: undefined}};
}
var __globalThisName__ = "global";
function initEnv(): Env {
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  return {head: // Global 'this' object available
    { name: __globalThisName__,
      value: { ctor: ValueType.Ref, name: __globalThisName__ } },
    tail: undefined};
}
// Equivalent of:
//     const this = {}
// Heap used once in initEnv, and another time in initStack
// Perhaps we should consider just rewriting the initial program?
function initHeap(): Heap {
  return { [__globalThisName__]: { ctor: ValueType.Obj, value: {} } }
}
// Converts a node/environment to an initial program
function initProg(node: AnyNode, env: Env = initEnv()): Prog {
  return {context: [], stack: initStack(env, node), heap: initHeap()};
}

var uniqueID = 0;
function uniqueRef(name) {
  return name + (uniqueID++);
}
// Deep clones an object.
// Possibility to provide overrides and reuses
//   as nested objects where leaves are
//   For overrides:
//     {__with__: X} for overrides of the previous value with X
//     {__clone__: Path} for of the previous value with the given path
//     name: X if the name was not present already in the object
//   For reuses:
//     true to just return the entire object
//     {__reuse__: true} to reuse all children not touched by overrides fields
function copy<a>(object: a, overrides?, reuses?): a {
  if(typeof overrides == "object") {
    if("__with__" in overrides) {
      return overrides.__with__;
    }
  }
  if(typeof reuses == "boolean" && reuses === true) {
    return object;
  }
  if(typeof overrides == "undefined" && typeof reuses == "object" && ("__reuse__" in reuses)) {
    return object;
  }
  if(typeof object == "object") {
    let model: any;
    if(Array.isArray(object)) {
      model = [];
    } else {
      model = {};
    }
    for(let k in object) {
      model[k] =
        copy(object[k],
          typeof overrides == "object" ? overrides[k] : undefined,
          typeof reuses == "object" ? ("__reuse__" in reuses ? reuses : reuses[k]) : undefined);
    }
    if(typeof overrides == "object") {
      for(let k in overrides) {
        if(k !== "__with__" && !(k in object)) {
          let newEntry = overrides[k];
          if(typeof newEntry === "object" && newEntry !== null && "__with__" in newEntry) // Just in case it was described as an override
            newEntry = newEntry.__with__;
          model[k] = newEntry;
        }
      }
    }
    return model;
  }
  return object;
}
// Returns true if obj1 and obj2 are deeply equal. Careful: Do not provide cyclic inputs !
function areEqual(obj1, obj2): boolean {
  if(typeof obj1 !== typeof obj2) return false;
  if(obj1 === null || obj2 === null) return obj1 === obj2;
  switch(typeof obj1) {
    case "object":
      let isArray1 = Array.isArray(obj1)
      if(isArray1 != Array.isArray(obj2)) return false;
      if(isArray1) {
        if(obj1.length != obj2.length) return false;
        for(let k = 0; k < obj1.length; k++) {
          if(!areEqual(obj1[k], obj2[k])) return false;
        }
        return true;
      } else {
        if(!areEqual(Object.keys(obj1), Object.keys(obj2))) return false;
        for(let k in obj1) {
          if(!areEqual(obj1[k], obj2[k])) return false;
        }
        return true;
      }
    default:
      return obj1 === obj2;
  }
}

type AnyNode = Node.ExportableDefaultDeclaration// & { update?: (prog: Prog, newVal: UpdateData) => UpdateAction }
type Prog = {
  context: AnyNode[], // Expression context (for clones)
  heap: Heap, // Indirect or direct binding from heap locations to computation sources
  stack: Stack}      // Stack of remaining operations. Initially a initStack(program). Each stack element may or may not contain an environment
type UpdateData = {newVal: any, oldVal: any, diffs?: Diffs}
declare let Logger: { log: (content: any) => any };
declare function mergeUpdatedEnvs(env1: Env, env2: Env): Res<string,Env>;
declare function uneval_(x: any, indent?: string): string
declare function buildEnvJS_(env: Env): any
declare function evaluate_(env: Env, $$source$$$: string): any
declare function newCall(s: string, args: any[]): any

enum DType {
    Update = "Update", // Regular diffs
    Merge = "Merge" // Only for reverse diffs
};
enum DUType {
  Reuse = "Reuse",
  NewValue = "NewValue",
};
type DKindNew = 
  {ctor: DUType.NewValue, model: any};
type Path = { up: number, down: List<string> };
type DUKindReuse = 
  {ctor: DUType.Reuse, path: Path}
type DKind = DUKindReuse | DKindNew;
interface ChildDiffs {
  [key: string]: Diffs
}
type DUpdate = { ctor: DType.Update, kind: DKind, children: ChildDiffs };
type DMerge = { ctor: DType.Merge, diffs: Diffs[] }
type Diff = DUpdate | DMerge

// Specializations of diffs
type DUpdateReuse = { ctor: DType.Update, kind: DUKindReuse, children: ChildDiffs };
type DClone       = DUpdateReuse;
type Diffs = Diff[];
var idPath: Path = { up: 0, down: undefined};

function isIdPath(p: Path): Boolean {
  return p.up === 0 && typeof p.down === "undefined";
}
function DDMerge(...args: Diffs[]): Diffs {
  return [{ctor: DType.Merge, diffs: args}];
}
function DReuse(childDiffs: ChildDiffs, path: Path = idPath): DUpdate {
  let existSame = false;
  for(let cd in childDiffs) {
    if(isDDSame(childDiffs[cd])) {
      existSame = true;
      break;
    }
  }
  let filteredChildDiffs: ChildDiffs;
  if(existSame) {
    filteredChildDiffs = {};
    for(let cd in childDiffs) {
      if(!isDDSame(childDiffs[cd])) {
        filteredChildDiffs[cd] = childDiffs[cd];
      }
    }
  } else {
    filteredChildDiffs = childDiffs
  }
  // Do some filtering on childDiffs, remove DDSame
  return {
    ctor: DType.Update,
    kind: {path: path, ctor: DUType.Reuse },
    children: filteredChildDiffs
  };
}
function DDReuse(childDiffs: ChildDiffs, path: Path = idPath): DUpdate[] {
  return [DReuse(childDiffs, path)];
}
function DDChild(name: string[] | string, childDiffs: Diffs): Diffs {
  if(typeof name === "string") {
    return DDReuse({[name]: childDiffs})
  } else {
    if(name.length == 0) return childDiffs;
    return DDChild(name[0], DDChild(name.slice(1), childDiffs));
  }
}
function DDExtract(name: string[] | string, diffs: Diffs): Diffs {
  if(typeof name === "string") {
    return array_flatten(diffs.map(diff =>
      diff.ctor === DType.Update && isIdPath(diff.path) ?
        diff.kind.ctor === DUType.Reuse ?
          diff.children[name] || DDSame()
        : undefined
      : undefined
    ));
  } else {
    if(name.length == 0) return diffs;
    return DDExtract(name.slice(1), DDExtract(name[0], diffs));
  }
}
function DDMap(name: string[] | string, diffs: Diffs, diffUpdater: (ds: Diffs) => Diffs): Diffs {
  if(typeof name === "string") {
    return diffs.map(diff =>
      diff.ctor === DType.Update && isIdPath(diff.path) ?
         copy(diff, {
           children: {
             [name]: diffUpdater(diff.children[name])
           }}, {__reuse__: true}) : diff
    )
  } else {
    if(name.length === 0) return diffUpdater(diffs);
    return DDMap(name[0], diffs, d => DDMap(name.slice(1), d, diffUpdater));
  }
}
function DDrop(diffs: Diffs, length: number): Diffs {
  if(length <= 0) return diffs;
  var candidates = diffs.map(diff =>
    diff.ctor === DType.Update && isIdPath(diff.path) ?
      typeof diff.children.tail != "undefined" ?
        DDrop(diff.children.tail, length - 1) :
        DDSame()
      : undefined
  );
  return array_flatten(candidates);
}
function DDNewValue(newVal: any): DUpdate[] {
  return [{ctor: DType.Update, path: idPath, kind: {ctor: DUType.NewValue, model: newVal}, children: {}}];
}
function DDNewObject(children: ChildDiffs, model = {}, path: Path = idPath): DUpdate[] {
  return [{ctor: DType.Update, path: path, kind: {ctor: DUType.NewValue, model: model}, children: children}];
}
function DDNewArray(length: number, children: ChildDiffs): DUpdate[] {
  return [{ctor: DType.Update, path: idPath, kind: {ctor: DUType.NewValue, model: Array(length)}, children: children}];
}
function DDNewNode(model: any, children = {}): DUpdate[] {
  return [{ctor: DType.Update, path: idPath, kind: {ctor: DUType.NewValue, model: model}, children: children}]
}

function DDClone(path: string | string[] | Path, children: ChildDiffs = {}): DClone[] {
  return [{
    ctor: DType.Update,
    path: (typeof path == "string" ? {up: 0, down: {head: path, tail: undefined}} :
      Array.isArray(path) ? { up: 0, down: List.fromArray(path as string[]) } :
      Array.isArray(path.down) ? { up: path.up, down: List.fromArray(path.down as string[]) } : path),
    kind: {ctor: DUType.Reuse}, children: children}];
}
function DDSame(): Diffs {
  return [{ctor: DType.Update, path: idPath, kind: {ctor: DUType.Reuse}, children: {}}];
}
function DDMapDownPaths(mapper, diffs: Diffs): Diffs {
  return diffs.map(diff =>
    diff.ctor == DType.Update && diff.path.up === 0 ?
      copy(diff, { path: { down: {__with__: mapper(diff.path.down) }}}, {__reuse__: true}) :
      diff);
}
function isDDSame(diffs: Diffs): boolean {
  if(diffs.length != 1) return false;
  let diff: Diff = diffs[0];
  if(diff.ctor !== DType.Update || !isIdPath(diff.path)) return false;
  if(diff.kind.ctor != DUType.Reuse) return false;
  return Object.keys(diff.children).length == 0;
}

function insertionCompatible(diffs: Diffs | undefined): boolean {
  if(typeof diffs == "undefined") return false; // Means the "undefined" is the final value in the array.
  return arrayAll(diffs,
    diff =>
      diff.ctor === DType.Update && (diff.kind.ctor == DUType.NewValue &&
      arrayAll(Object.keys(diff.children), key => insertionCompatible(diff.children[key])) ||
        isSimpleChildClone(diff)
      ));
}

// Merges two diffs made on the same object.
function mergeDiffs(diffs1: Diffs, diffs2: Diffs): Diffs {
  //console.log("mergeDiffs(\n" + uneval_(diffs1, "") + ",\n " + uneval_(diffs2, "") + ")")
  if(isDDSame(diffs1)) return diffs2;
  if(isDDSame(diffs2)) return diffs1;
  let result: Diffs = [];
  for(let id1 = 0; id1 < diffs1.length; id1++){
    let diff1: Diff = diffs1[id1];
    if(diff1.ctor !== DType.Update) continue;
    for(let id2 = 0; id2 < diffs2.length; id2++){
      let diff2: Diff = diffs2[id2];
      if(diff2.ctor !== DType.Update) continue;
      if(isIdPath(diff1.path) && isIdPath(diff2.path)) {
        if(diff1.kind.ctor == DUType.Reuse && diff2.kind.ctor == DUType.Reuse) {
          let c1 = diff1.children;
          let c2 = diff2.children;
          let resultingChildren = {};
          for(let k in c1) {
            let merged: Diffs;
            if(k in c2) {
              merged = mergeDiffs(c1[k], c2[k]);
            } else {
              merged = c1[k];
            }
            resultingChildren[k] = merged;
          }
          for(let k in c2) {
            if(!(k in resultingChildren)) {
              resultingChildren[k] = c2[k];
            }
          }
          result.push({ctor: DType.Update, path: idPath, kind: { ctor: DUType.Reuse}, children: resultingChildren});
          continue;
        }
        if(diff1.kind.ctor == DUType.NewValue && diff2.kind.ctor == DUType.NewValue &&
          Array.isArray(diff1.kind.model) && Array.isArray(diff2.kind.model)) {
          // Two array that have changed. We treat modified children that are new as insertions so that we can merge them in one way or the other. This works only if all children are either clones or new values, and the model does not contain built-in values
          if(arrayAll(diff1.kind.model, (x, i) => typeof x === "undefined" && insertionCompatible((diff1 as DUpdate).children[i])) &&
             arrayAll(diff2.kind.model, (x, i) => typeof x === "undefined" && insertionCompatible((diff2 as DUpdate).children[i]))) {
            // All keys are described by Clone or New Children.
            let groundTruthOf = function(diff: DUpdate): Diffs[] {
              let result: Diffs[] = [];
              for(let k in diff.children) {
                result.push(diff.children[k]);
              }
              return result;
            }
            let cloneIndexOf = function(ds: Diffs): Number | undefined {
              if(ds.length == 1) {
                let d = ds[0];
                if(d.ctor == DType.Update && d.path.up == 0 && List.length(d.path.down) == 1) {
                  return Number(d.path.down.head);
                }
              }
              return undefined;
            }
            let insertionsDeletionsOf = function(groundTruth: Diffs[]): {insertedAfter: any, deleted: any} {
              // Find the elements in sequence, record elements that were deleted.
              let deleted = {};
              let insertedAfter = {};
              let lastIncludedIndex = -1;
              for(let k = 0; k < groundTruth.length; k++) {
                let ds: Diffs = groundTruth[k];
                let dPath = cloneIndexOf(ds);
                if(typeof dPath == "number" && lastIncludedIndex < dPath) {
                  while(lastIncludedIndex < dPath) {
                    lastIncludedIndex++;
                    if(lastIncludedIndex < dPath) {
                      deleted[lastIncludedIndex] = true;
                    }
                  }
                  continue;
                }
                insertedAfter[lastIncludedIndex] = insertedAfter[lastIncludedIndex] || [];
                insertedAfter[lastIncludedIndex].push(ds);
              }
              return { deleted: deleted, insertedAfter: insertedAfter};
            }
            let doInsert = function(solutionFiltered, insertedAfter) {
              // Now we insert
              toInsert: for(let indexAfterWhichToInsert in insertedAfter) {
                let ip = +indexAfterWhichToInsert;
                let diffssToInsert = insertedAfter[indexAfterWhichToInsert];
                for(let k = 0; k < solutionFiltered.length; k++) {
                  let ci = cloneIndexOf(solutionFiltered[k]);
                  if(typeof ci == "number" && ci >= ip) { // TODO: We could list every possible insertion as well.
                    solutionFiltered.splice(k + 1, 0, ...diffssToInsert);
                    continue toInsert;
                  }
                }
                solutionFiltered.push(...diffssToInsert);
              }
            }
            let arrayDiffOf = function(dss: Diffs[]): DUpdate {
              let model = Array(dss.length);
              let children = {};
              for(let i = 0; i < model.length; i++) {
                model[i] = undefined;
                children[i] = dss[i];
              }
              return { ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: model}, children: children };
            }
            let filterFromDeletion = function(solution, deleted) {
              // Filter out only the first element of each kind.
              let prevDeleted = -1;
              return solution.filter((ds, k) => {
                 let c = cloneIndexOf(ds);
                 if(typeof c === "number" && c > prevDeleted) {
                   prevDeleted = c;
                   return deleted[c + ""] !== true;
                 }
                 return true;
              });
            }
            let solution1 = groundTruthOf(diff1);
            let {insertedAfter: insertedAfter1, deleted: deleted1} = insertionsDeletionsOf(solution1);
            let solution2 = groundTruthOf(diff2);
            let {insertedAfter: insertedAfter2, deleted: deleted2} = insertionsDeletionsOf(solution2);
            let solution1Filtered = filterFromDeletion(solution1, deleted2);
            let solution2Filtered = filterFromDeletion(solution2, deleted1);
            doInsert(solution1Filtered, insertedAfter2);
            doInsert(solution2Filtered, insertedAfter1);
            
            let d1 = arrayDiffOf(solution1Filtered);
            let d2 = arrayDiffOf(solution2Filtered);
            if(areEqual(d1, d2))
              return [d1];
            return [d1, d2];
          }
        }
        if(diff2.kind.ctor == DUType.NewValue) {
          // If there is a {ctor: DType.Clone, path: [], diffs: DSame()} below, we can merge it with the current diffs.
          let c2 = diff2.children;
          let resultingChildren = {};
          for(let k in c2) {
            let merged: Diffs = mergeDiffs([diff1], c2[k]);
            resultingChildren[k] = merged;
          }
          result.push({ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: diff2.kind.model}, children: resultingChildren});
        }
        if(diff1.kind.ctor == DUType.NewValue) {
          // If there is a {ctor: DType.Clone, path: [], diffs: DSame()} below, we can merge it with the current diffs.
          let c1 = diff1.children;
          let resultingChildren = {};
          for(let k in c1) {
            let merged: Diffs = mergeDiffs(c1[k], [diff2]);
            resultingChildren[k] = merged;
          }
          result.push({ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: diff1.kind.model}, children: resultingChildren});
        }
      } else { // One of them is a clone, so an entire replacement. Clones discard other changes.
        let doDiffs = function(diff1: DUpdate, diff2: DUpdate) {
          if(!isIdPath(diff1.path)) {
            if(List.length(diff1.path.down) === 1 &&
               diff1.path.up === 0 &&
               isIdPath(diff2.path) && diff2.kind.ctor == DUType.Reuse) { // Particular case when the part we are cloning was moved somewhere else.
              let down = diff1.path.down;
              let subDiffs2 = diff2.children[down.head]; // What happened in diff2 to the element we are cloning from in diff1?
              if(subDiffs2.length === 1){
                let subDiff2: Diff = subDiffs2[0];
                if(subDiff2.ctor === DType.Update && !isIdPath(subDiff2.path) && subDiff2.path.up === 1) {
                  let children = copy(subDiff2.children, {}, {__reuse__: true});
                  for(let k in diff1.children) {
                    if(k in children) {
                      children[k] = mergeDiffs(children[k], diff1.children[k]);
                    } else {
                      children[k] = diff1.children[k];
                    }
                  }
                  result.push({ ctor: DType.Update, path: { up: 0, down: subDiff2.path.down}, kind: {ctor: DUType.Reuse}, children: children });
                  return;
                }
              }
            }
            result.push(diff1);
          }
        }
        doDiffs(diff1, diff2);
        if(!isIdPath(diff2.path)) {
          // If same clone, we discard
          if(!isIdPath(diff1.path) && areEqual(diff1.path, diff2.path)) {
            continue;
          }
          doDiffs(diff2, diff1);
        }
      }
    }
  }
  return result;
}

type VSAEntry = number | string | boolean | {[key: string]: VSA} | {[key: number]: VSA}
type VSA = VSAEntry[]

function walkPath(obj: any, context: List<any>, path: Path, diffs: boolean = false): [any, List<any>] {
  let up = path.up;
  let c = context;
  let o = obj;
  while(up) {
    if(typeof c == undefined) {
      console.log(path);
      console.log(context);
      console.log(obj);
      throw "walk outside of context in applyDiffs"
    }
    o = c.head;
    c = c.tail;
    up--;
  }
  let down = path.down;
  while(typeof down !== "undefined") {
    if(typeof o !== "object") {
      console.log(path);
      console.log(context);
      console.log(o);
      throw "Clone outside of range in applyDiffs"
    }
    c = cons_(o, c);
    o = diffs ? o[0].children[down.head] : o[down.head];
    down = down.tail;
  }
  return [o, c]
}

// Given an object and a VSA of diffs on in, returns a VSA of the updated object (i.e. each property is wrapped with an array)
function applyDiffs(obj: any, diffs: Diffs, context: List<any> = undefined): VSA {
  let result: VSA = [];
  for(let diff of diffs) {
    if(diff.ctor === DType.Update) {
      let children = diff.children;
      let oneResult: {[key: string]: VSA};
      let c: List<any>;
      [obj, c] = walkPath(obj, context, diff.path);
      if(diff.kind.ctor === DUType.Reuse) {
        oneResult = typeof obj === "object" ? Array.isArray(obj) ? [] as unknown as {[key: string]: VSA} : {} : obj;
        for(let k in obj) {
          if(!(k in children)) {
            oneResult[k] = [obj[k]]
          }
        }
      } else {
        oneResult = copy(diff.kind.model) as {[key: string]: VSA};
      }
      for(let k in children) {
        let ds = children[k];
        oneResult[k] = applyDiffs(
          diff.kind.ctor == DUType.Reuse ? obj[k] : obj,
          ds,
          diff.kind.ctor == DUType.Reuse ? cons_(obj, c) : c);
      }
      result.push(oneResult);
    } // Merge cannot be applied at this point.
  }
  return result;
}

// Given a VSA, returns all its elements in linear order. Should be fine for most purposes
function enumerateDirect(vsa: VSA, result: any[] = []): any[] {
  for(let vsaEntry of vsa) {
    if(typeof vsaEntry === "object") {
      let keys = Object.keys(vsaEntry);
      if(keys.length == 0) {
        result.push(Array.isArray(vsaEntry) ? [] : {});
        continue;
      }
      let hKey = keys[0];
      let vsaWithoutHeadKey = copy(vsaEntry, {}, {__reuse__: true}); // Copy the object, keeps children refs.
      delete vsaWithoutHeadKey[hKey];
      let hValues = enumerateDirect(vsaEntry[hKey]);
      for(let tValue of enumerateDirect([vsaWithoutHeadKey])) {
        for(let hValue of hValues ) {
          let tmpResult = copy(tValue, {}, {__reuse__: true});
          tmpResult[hKey] = hValue;
          result.push(tmpResult);
        }
      }
    } else {
      result.push(vsaEntry);
    }
  }
  return result;
}

// Same as applyDiffs but returns the first result (composition of enumerateDirect and applyDiffs)
function applyDiffs1(obj: any, diffs: Diffs, context: List<any> = undefined): any {
  let result: any;
  for(let diff of diffs) {
    //console.log("applyDiffs1(\n" + uneval_(obj, "") + "\n, \n" + uneval_(diff, "") + "\n, \n" + uneval_(context, "") + "\n") 
    if(diff.ctor === DType.Update) {
      let children = diff.children;
      let up = diff.path.up;
      let c: List<any>;
      [obj,c] = walkPath(obj, context, diff.path);
      if(diff.kind.ctor === DUType.Reuse) {
        result = typeof obj == "object" ? Array.isArray(obj) ? [] : {} : obj;
        for(let k in obj) {
          if(!(k in children)) {
            result[k] = obj[k];
          }
        }
      } else {
        result = copy(diff.kind.model) as {[key: string]: any};
      }
      for(let k in children) {
        let ds = children[k];
        result[k] = applyDiffs1(
          diff.kind.ctor == DUType.Reuse ? obj[k] : obj,
          ds,
          diff.kind.ctor == DUType.Reuse ? cons_(obj, c) : c);
      }
    } // Merge cannot be applied at this point.
    //console.log("= \n" + uneval_(result))
    break; // only the first result matters
  }
  return result;
}

// Takes a default model, and refines it by adding the clone (diff) at the given path (down)
function addToDefaultModel(down: List<string>, diff: DClone, defaultModels: Diffs) {
  let d = defaultModels[0];
  if(typeof down === "undefined") {
    if(d.ctor == DType.Update && d.kind.ctor == DUType.NewValue && Object.keys(d.children).length == 0) {
      // Just overwrite the existing value here.
      defaultModels.pop();
      defaultModels.push(diff);
    } else if(d.ctor == DType.Update && d.kind.ctor == DUType.Reuse && Object.keys(d.children).length == 0) { // Existing clone
      let existing = defaultModels.pop();
      defaultModels.push({ctor: DType.Merge, diffs: [[existing], [diff]]})
    } else if(d.ctor == DType.Merge) {
      d.diffs.push([diff]);
    } else {
      console.log(uneval_(defaultModels, ""))
      console.log(uneval_(down, ""))
      console.log(uneval_(diff, ""))
      throw "Unexpected diff for addToDefaultModel"
    }
  } else if(d.ctor === DType.Update && d.kind.ctor === DUType.NewValue) {
    let k = down.head;
    if(!(k in d.children)) {
      d.children[k] = DDNewObject({}, d.kind.model[k]);
      d.kind.model[k] = undefined;
    }
    addToDefaultModel(down.tail, diff, d.children[k]);
  } else {
    throw "Diff not supported for addToDefaultModel: " + uneval_(diff, "")
  }
}

// applyDiffs1(applyDiffs1(obj, diffs), reverseDiffs(obj, diffs)) = obj
function reverseDiffs(obj: any, diffs: Diffs, context: List<any> = undefined): Diffs {
  let defaultModels = DDNewObject({}, copy(obj)); // The reverse diffs that just output obj. We are going to modify it.
  let diff: Diff = diffs[0];
  // Let's find all children or sub-children that can be recovered from the diffs.
  function aux(diff: Diff,
               context: List<string> = undefined, // Context in the original program
               subContext: List<string> = undefined // context in the sub program
               ) {
    if(diff.ctor !== DType.Update)
      return;
    if(diff.path.up !== 0 || typeof diff.path.down !== "undefined") {
      // It's a clone. We'll walk the path to find where to insert the inverse clone in the defaultModels
      let pathFromTop = List.reverseInsert(List.drop(subContext, diff.path.up), diff.path.down);
      addToDefaultModel(
        pathFromTop,
        {ctor: DType.Update, path: {up: 0, down: List.reverseInsert(undefined, context)}, kind: {ctor: DUType.Reuse}, children: {}},
        defaultModels
      );
    } else {
      for(let k in diff.children) {
        let subDiff = diff.children[k][0];
        aux(subDiff, diff.kind.ctor == DUType.Reuse ? cons_(k, context) : context, cons_(k, subContext));
      }
    }
  }
  aux(diff);
  return defaultModels;
}

function applyHorizontalDiffs(diffs: Diffs, hDiffs: Diffs): Diffs {
  let results: Diffs = [];
  for(let i = 0; i < hDiffs.length; i++) {
    let hDiffs1 = hDiffs[i];
    if(hDiffs1.ctor == DType.Update) {
      if(hDiffs1.kind.ctor == DUType.NewValue) {
        let children = {};
        for(let k in hDiffs1.children) {
          children[k] = applyHorizontalDiffs(diffs, hDiffs1.children[k]);
        }
        results.push(DReuse(children));
      } else if(hDiffs1.kind.ctor == DUType.Reuse && (hDiffs1.path.up === 0 || typeof hDiffs1.path.down != "undefined")) {
        let [targetDiffs, context] = walkPath(diffs, undefined, hDiffs1.path, /*diffs=*/true);
        results.push(...targetDiffs);
      } else {
        console.log(uneval_(hDiffs1, ""));
        throw "Unsupported horizontal diffs (only clones and news are supported). See console"
      }
    } else { // Merge of several diffs
      let dds = hDiffs1.diffs;
      let acc = applyHorizontalDiffs(diffs, dds[0]);
      for(let i = 1; i < dds.length; i++) {
        acc = mergeDiffs(acc, applyHorizontalDiffs(diffs, dds[i]));
      }
      results.push(...acc);
    }
  }
  return results;
}

// Composes two Diffs into a single Diffs. Diffs cannot be merge diffs for now.
function composeDiffs(diffs1: Diffs, diffs2: Diffs): Diffs {
  if(isDDSame(diffs1)) return diffs2;
  if(isDDSame(diffs2)) return diffs1;
  let aux = function(diffs1: Diffs, diffs1context: List<Diffs>, diffs2: Diffs): Diffs {
    let targetDiffs1 = diffs1;
    let targetDiffs1Context = diffs1context;
    let diff2 = diffs2[0] as DUpdate;
    if(diff2.path.up !== 0 || typeof diff2.path.down !== "undefined") {
      let [targetDiffs1, targetDiffs1Context] = walkPath(diffs1, diffs1context, diff2.path, /*diffs=*/true);
    }
    if(diff2.kind.ctor == DUType.Reuse) {
      let diff1 = targetDiffs1[0] as DUpdate;
      let ctor = diff1.ctor; // If the first diff was a Reuse or a NewValue, it stays the same.
      let composedDiffs: ChildDiffs = {};
      let model = diff1.kind.ctor === DUType.NewValue ? copy(diff1.kind.model) : {};
      for(let k in diff2.children) {
        let sub2diff = diff2.children[k];
        if(k in diff1.children) {
          composedDiffs[k] = aux(diff1.children[k], cons_(targetDiffs1, targetDiffs1Context), diff2.children[k]);
          model[k] = undefined;
        } else if(diff1.kind.ctor === DUType.NewValue) {
          if(typeof diff1.kind.model == "object" && (k in diff1.kind.model)) {
            composedDiffs[k] = aux(DDNewObject({}, diff1.kind.model[k]), cons_(targetDiffs1, targetDiffs1Context), diff2.children[k]);
            model[k] = undefined;
          } else { // The key that diff2 references is not valid.
            console.log(uneval_(diffs1, "") + "\ncannot be composed with\n" + uneval_(diffs2, ""));
            console.log("The second diffs refers to field '" + k + "' which is not present in the old DNewValue.")
            throw "Diff Composition error -- See console."
          }
        } else if(diff1.kind.ctor === DUType.Reuse) { // then k is composed with identity
          composedDiffs[k] = diff2.children[k];
        }
      }
      if(diff2.kind.ctor == DUType.Reuse && diff1.kind.ctor == DUType.NewValue && typeof diff1.kind.model === "object") {
        for(let k in diff1.kind.model) {
          if(!(k in model)) model[k] = diff1.kind.model[k];
        }
      }
      let kind: DKind = diff1.kind.ctor == DUType.Reuse ? diff1.kind : {ctor: DUType.NewValue, model: model};
      return [{ctor: ctor, path: diff1.path, kind: kind, children: composedDiffs}]
    } else { // New value overrides the previous one.
      let newChildren = {};
      for(let k in diff2.children) {
        newChildren[k] = aux(targetDiffs1, targetDiffs1Context, diff2.children[k]);
      }
      return [copy(diff2, {children: {__with__: newChildren}}, {__reuse__: true})];
    }
  }
  return aux(diffs1, undefined, diffs2);
}

// Given an object-only model with {__clone__: ...} references to the object,
// and the diffs of the new object, builds the value and the diffs associated to the model
function DDRewrite(model, obj, diffs): [any, Diffs] {
  if(typeof model === "object") {
    if(typeof model.__clone__ === "string" || Array.isArray(model.__clone__)) {
      let ds = DDExtract(model.__clone__, diffs);
      var x = obj;
      var path = typeof model.__clone__ === "string" ? [model.__clone__] : model.__clone__;
      for(var i = 0; i < path.length; i++) {
        x = x[path[i]];
      }
      return [x, ds];
    }
    // Regular object
    let finalValue = Array.isArray(model) ? [] : {};
    let childDiffs = {};
    for(let k in model) {
      let ds = model[k];
      let [childValue, childDiffs] = DDRewrite(model[k], obj, diffs);
      finalValue[k] = childValue;
      childDiffs[k] = childDiffs;
    }
    let finalDiffs = DDReuse(childDiffs);
    return [finalValue, finalDiffs];
  } else {
    console.log(model);
    throw "DDRewrite called with non-object as a model"
  }
}

enum UType {
    Result,
    Continue,
    Fail,
    CriticalError,
    Alternative
}

type UpdateCallback = (newProg: Prog, diffs: Diffs, oldProg: Prog) => UpdateAction
type UpdateResult = {ctor: UType.Result, newProg: Prog, diffs: Diffs, oldProg: Prog, callback: undefined | UpdateCallback};
type UpdateFail = {ctor: UType.Fail, msg: string};
type UpdateCriticalError = {ctor: UType.CriticalError, msg: string};
type UpdateContinue = {ctor: UType.Continue, prog: Prog, updateData: UpdateData, callback: undefined | UpdateCallback};
type UpdateAlternative = { ctor: UType.Alternative, alternatives: UpdateAction[]};
type UpdateAction = UpdateFail | UpdateCriticalError | UpdateResult | UpdateContinue | UpdateAlternative;
type Fork = {action: UpdateAction, callbacks: UpdateCallback[]};
type ProgWithAlternatives = {prog: Prog, diffs: Diffs, alternatives: Fork[] };

function UpdateContinue(p: Prog, n: UpdateData, c?: UpdateCallback): UpdateContinue {
  return {ctor: UType.Continue, prog: p, updateData: n, callback: c};
}
function UpdateResult(p: Prog, d: Diffs, oldP: Prog, c?: UpdateCallback): UpdateResult {
  return {ctor: UType.Result, newProg: p, diffs: d, oldProg: oldP, callback: c};
}
function UpdateFail(msg: string): UpdateFail {
  return {ctor: UType.Fail, msg: msg};
}
function UpdateCriticalError(msg: string): UpdateCriticalError {
  return {ctor: UType.CriticalError, msg: msg};
}
function UpdateAlternative(...actions: UpdateAction[]): UpdateAction {
  if(actions.length === 1) {
    return actions[0];
  }
  return {ctor: UType.Alternative, alternatives: actions};
}
/*
interface Updatable {
  update(prog: Prog, newVal: UpdateData): UpdateAction
}
*/
function processUpdateAction(
    action: UpdateAction,
    callbacks: UpdateCallback[] = [],
    forks: Fork[] = []): Res<string, ProgWithAlternatives> {
  while( action.ctor != UType.Result ||
         action.callback ||
         callbacks.length != 0 ) {
    if(action.ctor == UType.Result) {
      if(action.callback) callbacks.push((action as UpdateResult).callback);
      action = callbacks.pop()(action.newProg, action.diffs, action.oldProg);
    } else if(action.ctor == UType.Continue) {
      if(action.callback) callbacks.push(action.callback);
      action = getUpdateAction(action.prog, action.updateData);
    } else if(action.ctor == UType.Fail) {
      if(forks.length) {
        let fork = forks.pop();
        action = fork.action;
        callbacks = fork.callbacks;
      } else {
        return Err(action.msg);
      }
    } else if(action.ctor == UType.CriticalError) {
      return Err((action as UpdateCriticalError).msg);
    } else if(action.ctor == UType.Alternative) {
      if(action.alternatives.length == 0) {
        action = UpdateFail("Empty alternatives");
      } else {
        for(var i = 1; i < action.alternatives.length; i++) {
          forks.push({action: action.alternatives[i], callbacks: callbacks.slice() });
        }
        action = action.alternatives[0];
      }
    } else {
      return Err("Unknown update action: " + (action as any).ctor);
    }
  }
  return Ok({prog: action.newProg, diffs: action.diffs, alternatives: forks});
}

// TODO: Incorporate custom path map.
function processClone(prog: Prog, newVal: any, oldVal: any, diff: DUpdateReuse, callback?: UpdateCallback): UpdateAction {
  // TODO: Process a diff for that instead of hard-coding.
  var Syntax = syntax.Syntax || esprima.Syntax;
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  let oldNode = (prog.stack.computations.head as ComputationNode).node;
  if(diff.kind.path.up <= prog.context.length) {
    var toClone: AnyNode = diff.kind.path.up == 0 ? oldNode : prog.context[diff.path.up - 1];
    var nodePathDown = List.builder();
    let downPath = diff.path.down;
    while(typeof downPath !== "undefined") {  // We map down path elems to AST
      let downpathelem = downPath.head;
      if(toClone && toClone.type == Syntax.ArrayExpression && typeof (toClone as Node.ArrayExpression).elements[downpathelem] != "undefined") {
        nodePathDown.append("elements");
        nodePathDown.append(downpathelem);
        toClone = (toClone as Node.ArrayExpression).elements[downpathelem];
      } else
        return UpdateFail("Cloning path not supported for " + downpathelem + " on " + (toClone ? toClone.type : " empty path"));
      downPath = downPath.tail;
    }
    if(Object.keys(diff.children).length == 0 && diff.kind.ctor == DUType.Reuse) {
      return UpdateResult(
        copy(prog, { stack: { computations: { head: { node: {__with__:
        copy(toClone)}}}}}, {__reuse__: true}),
        DDChild(["stack", "computations", "head", "node"], DDClone({up: diff.path.up, down: nodePathDown.build() as List<string>})), prog, callback)
    } else {
      return UpdateContinue(
        copy(prog, {stack: { computations: { head: { node: {__with__: copy(toClone)}}}}}, {__reuse__: true})
        , {newVal: newVal, oldVal: oldVal, diffs: [{ctor: DType.Update, kind: {kind: diff.kind, path: idPath}, children: diff.children}]},
        callback || UpdateResult);
    }
  } else {
    return UpdateFail("Difference outside of context");
  }
}

function valToNodeDiffs_(value: any): DUpdate[] {
  return DDNewNode(value);
}

function keyValueToProperty(key: string, propertyValue: Node.PropertyValue): Node.Property {
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  let propertyKey = new Node.Identifier("", key, key);
  return new Node.Property("init", propertyKey, "", "", "", "", false, propertyValue, false, false);
}

function valToNode_(value: any): AnyNode {
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  if(typeof value == "number" || typeof value == "boolean" || typeof value == "string" || typeof value == "object" && value === null) {
    return new Node.Literal("", value, uneval_(value));
  } else if(typeof value == "object") {
    if(Array.isArray(value)) {
      return new Node.ArrayExpression("", value.map(valToNode_), [], "");
    } else {
      var children: Node.Property[] = [];
      for(let k in value) {
        var v = value[k];
        var propertyValue = valToNode_(v) as Node.PropertyValue;
        children.push(keyValueToProperty(k, propertyValue));
      }
      return new Node.ObjectExpression("", children, [], "");
    }
  }
  return new Node.Literal("", null, "null");
}

function filterDiffsNoClonesDown(diffs: Diffs): Diffs {
  var willBeEmpty = false;
  let newDiffs: Diffs = [];
  for(let diff of diffs) {
    if(diff.ctor == DType.Merge) {
      newDiffs.push(diff);
      continue;
    }
    if(diff.ctor == DUType.Reuse && !isIdPath(diff.kind.path)) {
      if(diff.kind.path.up != 0)
        newDiffs.push(diff);
      continue;
    }
    var newChildrenDiffs: ChildDiffs = {};
    for(let key in diff.children) {
      var newChildDiffs = filterDiffsNoClonesDown(diff.children[key]);
      if(newChildDiffs.length == 0) willBeEmpty = true;
      newChildDiffs[key] = newChildDiffs;
    }
    newDiffs.push(copy(diff, {children: {__with__: newChildrenDiffs}}, {__reuse__: true}));
  }
  if(willBeEmpty) return [];
  return newDiffs;
}

function processClones(prog: Prog, updateData: UpdateData,
     otherwise?: (diff: DUpdate) => UpdateAction ): UpdateAction {
  var Syntax = syntax.Syntax || esprima.Syntax;
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  return UpdateAlternative(...updateData.diffs.map(function(diff: Diff): UpdateAction {
    let oldNode = (prog.stack.computations.head as ComputationNode).node;
    if(diff.ctor === DType.Merge) {
      return UpdateFail("Cannot process clones if diff is DMerge");
    }
    if(diff.kind.ctor === DUType.Reuse && !isIdPath(diff.kind.path)) {
      return processClone(prog, updateData.newVal, updateData.oldVal, diff);
    } else if(diff.kind.ctor === DUType.NewValue) {
      let model = diff.kind.model;
      if((typeof model == "number" ||
           typeof model == "string" ||
           typeof model == "boolean") &&
             (oldNode.type == Syntax.Literal ||
              oldNode.type == Syntax.ArrayExpression ||
              oldNode.type == Syntax.ObjectExpression)) { // TODO: Deal with string literals in a better way.
        let oldFormat = oldNode.type === Syntax.Literal ? oldNode as Node.Literal : { wsBefore: oldNode.wsBefore, value: undefined, raw: uneval_(model), wsAfter: oldNode.wsAfter || ""};
        let newChildVal = new Node.Literal(oldFormat.wsBefore, oldFormat.value, oldFormat.raw);
        newChildVal.wsAfter = oldFormat.wsAfter;
        newChildVal.value = model;
        return UpdateResult(
              copy(prog, {stack: { computations: {head: { node: {__with__: newChildVal}}}}}, {__reuse__: true})
          ,DDChild(["stack", "head", "node"], valToNodeDiffs_(newChildVal))
          , prog);
      } else if(typeof model == "object") {
        // TODO: Adapt the Diff
        let oldFormat = oldNode.type === Syntax.ArrayExpression ? oldNode as Node.ArrayExpression : oldNode.type === Syntax.ObjectExpression ? oldNode as Node.ObjectExpression : { wsBefore: "", separators: [], wsBeforeClosing: ""};
        let newNode = valToNode_(model) as (Node.ArrayExpression | Node.ObjectExpression);
        let separators = oldFormat.separators;
        let numKeys = Array.isArray(model) ? model.length : Object.keys(model).length;
        if(separators.length >= numKeys) {
          separators = separators.slice(0, Math.max(0, numKeys - 1));
        }
        newNode.wsBefore = oldFormat.wsBefore;
        newNode.wsBeforeClosing = oldFormat.wsBeforeClosing;
        newNode.separators = separators;
        let newDiffs = DDNewNode(newNode);
        let gatherer =
          newNode.type === Syntax.ArrayExpression ?
            arrayGather(prog, newNode as Node.ArrayExpression, newDiffs)
            : objectGather(prog, Object.keys(updateData.newVal), newNode as Node.ObjectExpression, newDiffs);
        let diffToConsider: DUpdate = {...diff};
        let willBeEmpty = false;
        if(oldNode.type === Syntax.Identifier) {
          // For now, identifiers forbid the flow of (children) clones
          for(var k in diff.children) {
            diffToConsider.children[k] = filterDiffsNoClonesDown(diff.children[k]);
            willBeEmpty = willBeEmpty || diffToConsider.children[k].length == 0;
          }
        }
        if(willBeEmpty) {
          if(otherwise) return otherwise(diff);
          return undefined;
        }
        return updateForeach((prog.stack.computations.head as ComputationNode).env, Object.keys(updateData.newVal),
          k => callback => {
            let newChildVal = updateData.newVal[k];
            let childDiff = diffToConsider.children[k];
            if(typeof childDiff == "undefined") {
              let newChildNode = valToNode_(newChildVal);
              let newChildNodeDiffs = valToNodeDiffs_(newChildVal);
              return UpdateResult(copy(prog,
                { stack: {computations: {head: { node: {__with__: newChildNode}}}}}, {__reuse__: true}),
                DDChild(["stack", "head", "node"], newChildNodeDiffs), prog, callback);
            } else { // Clones and reuse go through this
              let oldChildVal = (updateData.oldVal as any[])[k];
              return UpdateContinue(prog, {
                   newVal: newChildVal, oldVal: oldChildVal, diffs: childDiff }, callback)
            }
          },
          gatherer
        );
      } else {
        if(otherwise) return otherwise(diff);
      }
    } else {
      if(otherwise) return otherwise(diff);
    }
    return undefined;
  }).filter(x => typeof x !== "undefined"));
}

function updateForeach<elem>(env: Env,
   collection: elem[], callbackIterator: (a: elem, i?: number) => (cb: UpdateCallback) => UpdateAction,
  gather: (env: Env, nodes: AnyNode[], manyDiffs: Diffs[]) => UpdateAction) {
  let aux = function(envSoFar, nodesSoFar: AnyNode[], diffsSoFar: Diffs[], i: number): UpdateAction {
    if(i < collection.length) {
      var elem = collection[i];
      return callbackIterator(elem, i)((newProg: Prog, diffs: Diffs, oldProg: Prog) => {
        var mergedEnv = mergeUpdatedEnvs(envSoFar, (newProg.stack.computations.head as ComputationNode).env)._0 as Env;
        return aux(mergedEnv, nodesSoFar.concat((newProg.stack.computations.head as ComputationNode).node), diffsSoFar.concat(diffs), i + 1);
      })
    } else {
      return gather(envSoFar, nodesSoFar, diffsSoFar);
    }
  }
  return aux(env, [], [], 0);
}

function arrayGather(prog: Prog, newNode: Node.ArrayExpression, newDiffs: DUpdate[]) {
  return function(newEnv: Env, newNodes: AnyNode[], newNodesDiffs: Diffs[]): UpdateAction {
    newNode.elements = newNodes;
    newDiffs[0].children.elements = DDReuse(newNodesDiffs as unknown as ChildDiffs); // FIXME: Not correct: elements form a new array.
    return UpdateResult(
      copy(prog, { stack: { head: { node: {__with__: newNode},
        env: {__with__: newEnv} }}}, {__reuse__: true})
      ,DDChild(["stack", "head", "node"], newDiffs)
      ,prog);
  }
}

function objectGather(prog: Prog, keys: string[], newNode: Node.ObjectExpression, newDiffs: DUpdate[]) {
  return function(newEnv: Env, newNodes: AnyNode[], newNodesDiffs: Diffs[]): UpdateAction {
    keys.map((key, k) => {
      newNode.properties.push(keyValueToProperty(key, newNodes[k] as Node.PropertyValue));
    });
    newDiffs[0].children.properties = DDReuse(newNodesDiffs.map((newNodeDiff) => DDReuse({value: newNodeDiff})) as unknown as ChildDiffs); // FIXME: Not reuse?!
    return UpdateResult(
      copy(prog,
        { stack: { head: { node: {__with__: newNode},
            env: {__with__: newEnv}}}}, {__reuse__: true}),
      DDChild(["stack", "head", "node"], newDiffs),
      prog);
  }
}
type WalkDecision = undefined | "avoid-children" | { type: "return", value: any }
type PreCall =  (node: any, path: List<string>) => WalkDecision
function walkNodes(nodes, preCall?: PreCall, postCall?, level?: List<string>) {
  for(let x of nodes) walkNode(x, preCall, postCall, cons_(x, level));
}
var walkers = undefined;
function walkNode(
    node: any,
    preCall?: PreCall,
    postCall?: (node: any, path: List<string>) => any,
    level?: List<string>) {
  if(typeof walkers == "undefined") {
    var Syntax = syntax.Syntax || esprima.Syntax;
    var rMany = (sub) => (node, preCall, postCall, level?: List<string>) => {
      var children = node[sub];
      if(children == null) return;
      for(let x of node[sub]) {
        let r = walkNode(x, preCall, postCall, cons_(x, level));
        if(typeof r !== "undefined") return r;
    } };
    var rChild = (sub) => (node, preCall, postCall, level) => {
      var child = node[sub];
      if(typeof child !== "undefined")
        return walkNode(child, preCall, postCall, cons_(sub, level));
    };
    var rElements = rMany("elements");
    var combine = (...rFuns) => (node, preCall, postCall, level) => {
      for(let rFun of rFuns) {
        if(typeof rFun === "string") rFun = rChild(rFun);
        var x = rFun(node, preCall, postCall, level)
        if(typeof x !== "undefined") return x;
      }
    }
    var rBody = rChild("body");
    var rFunctions = combine("id", rMany("params"), rBody);
    var rBinary = combine("left", "right");
    var rControl = rChild("label");
    var rClass = combine("id", "superClass", rBody);
    var rIf = combine("test", "consequent", "alternate");
    var rMember = combine("object", "property");
    walkers = {
      [Syntax.ArrayExpression]: rElements,
      [Syntax.ArrayPattern]: rElements,
      [Syntax.ArrowFunctionExpression]: rFunctions,
      [Syntax.AssignmentExpression]: rBinary,
      [Syntax.AssignmentPattern]: rBinary,
      [Syntax.AwaitExpression]: rChild("argument"),
      [Syntax.BinaryExpression]: rBinary,
      [Syntax.BlockStatement]: rBody,
      [Syntax.BreakStatement]: rControl,
      [Syntax.ContinueStatement]: rControl,
      [Syntax.CallExpression]: combine("callee", rMany("arguments")),
      [Syntax.CatchClause]: combine("param", rBody),
      [Syntax.ClassBody]: rBody,
      [Syntax.ClassDeclaration]: rClass,
      [Syntax.ClassExpression]: rClass,
      [Syntax.ConditionalExpression]: rIf,
      [Syntax.DebuggerStatement]: null,
      [Syntax.DoWhileStatement]: combine(rBody, "test"),
      [Syntax.EmptyStatement]: null,
      [Syntax.ExportAllDeclaration]: rChild("source"),
      [Syntax.ExportDefaultDeclaration]: rChild("declaration"),
      [Syntax.ExportNamedDeclaration]: combine("declaration", rMany("specifiers")),
      [Syntax.ExportSpecifier]: combine("exported", "local"),
      [Syntax.ExpressionStatement]: rChild(node.expression),
      [Syntax.ForInStatement]: combine(rBinary, rBody),
      [Syntax.ForOfStatement]: combine(rBinary, rBody),
      [Syntax.ForStatement]: combine("init", "test", "update", rBody),
      [Syntax.FunctionDeclaration]: rFunctions,
      [Syntax.FunctionExpression]: rFunctions,
      [Syntax.Identifier]: null,
      [Syntax.MemberExpression]: rMember,
      [Syntax.IfStatement]: rIf,
      [Syntax.Import]: null,
      [Syntax.ImportDeclaration]: combine(rMany("specifiers"), "source"),
      [Syntax.ImportDefaultSpecifier]: rChild("local"),
      [Syntax.ImportNamespaceSpecifier]: rChild("local"),
      [Syntax.ImportSpecifier]: combine("local", "imported"),
      [Syntax.LabeledStatement]: combine("label", rBody),
      [Syntax.Literal]: null,
      [Syntax.LogicalExpression]: rBinary,
      [Syntax.MetaProperty]: combine("meta", "property"),
      [Syntax.MethodDefinition]: combine("key", "value"),
      [Syntax.Program]: rMany("body"),
      [Syntax.NewExpression]: combine("callee", rMany("arguments")),
      [Syntax.ObjectExpression]: rMany("properties"),
      [Syntax.ObjectPattern]: rMany("properties"),
      [Syntax.Property]: combine("key", "value"),
      [Syntax.RestElement]: rChild("argument"),
      [Syntax.ReturnStatement]: rChild("argument"),
      [Syntax.SequenceExpression]: rMany("expressions"),
      [Syntax.SpreadElement]: rChild("argument"),
      [Syntax.Super]: null,
      [Syntax.SwitchCase]: combine("test", rMany("consequent")),
      [Syntax.SwitchStatement]: combine("discriminant", rMany("cases")),
      [Syntax.TaggedTemplateExpression]: combine("tag", "quasi"),
      [Syntax.TemplateElement]: null,
      [Syntax.TemplateLiteral]: combine(rMany("quasis"), rMany("expressions")),
      [Syntax.ThisExpression]: null,
      [Syntax.ThrowStatement]: rChild("argument"),
      [Syntax.TryStatement]: combine("block", "handler", "finalizer"),
      [Syntax.UnaryExpression]: rChild("argument"),
      [Syntax.UpdateExpression]: rChild("argument"),
      [Syntax.VariableDeclaration]: rMany("declarations"),
      [Syntax.VariableDeclarator]: combine("id", "init"),
      [Syntax.WhileStatement]: combine("test", rBody),
      [Syntax.WithStatement]: combine("object", rBody),
      [Syntax.YieldExpression]: rChild("argument")
    }
  }
  var x = preCall ? preCall(node, level) : undefined;
  if(typeof x === "object" && x.type === "return") return x.value;
  if(node !== null && x !== "avoid-children") {
    var walker = walkers[node.type];
    if(typeof walker === "function") {
      let x = walker(node, preCall, postCall, level);
      if(typeof x !== "undefined") return x;
    }
  }
  let y = postCall ? postCall(node, level) : undefined;
  if(typeof y !== "undefined") return y;
}

// Returns a rewriting Diffs (single-value) for a given body after moving declarations.
// [a list of declarations that will allocate a heap reference -- initially filled with "undefined" (no declarations if declarations = false),
// a list of definitions that have to be hoisted (e.g. function definitions)]
function hoistedDeclarationsDefinitions(body: AnyNode[], declarations = true): Diffs[] {
  var Syntax = syntax.Syntax || esprima.Syntax;
  var localVars: { [name: string]: Diffs} = {};
  var localDefinitions: {[name: string]: Diffs } = {}; 
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  walkNodes(body, (node: any, level: List<string>) => {
    // We hoist variable declarations
    if(declarations && node.type === Syntax.VariableDeclaration && node.kind === "var") {
      for(let declaration of (node as Node.VariableDeclaration).declarations) {
        if(declaration.id.type === Syntax.Identifier) {
          localVars[(declaration.id as Node.Identifier).name] =
            new Node.VariableDeclaration("\n",
              [new Node.VariableDeclarator(
                  declaration.id, " ", null)
              ], [], "let", ";");
        }
      }
    }
    // We hoist function declarations.
    // We hoist function definitions only if they are a top-level child
    if(node.type === Syntax.FunctionDeclaration) {
      let fd = node as Node.FunctionDeclaration;
      if(declarations) {
        localVars[(fd.id as Node.Identifier).name] =
          DDNewObject({}, new Node.VariableDeclaration("\n",
            [new Node.VariableDeclarator(
              fd.id as Node.Identifier, " ", null)
            ], [], "let", ";"));
      }
      if(typeof level.tail == "undefined") { // Top-level definitions.
        localDefinitions[(fd.id as Node.Identifier).name] =
          DDNewObject(
          { right: DDReuse(
            { type: DDNewValue(Syntax.FunctionExpression)},
            {up: 0, down: level}) },
          new Node.AssignmentExpression(" ","=", fd.id as Node.Identifier, new Node.Import("")))
      }
    }
    // We ignore declarations inside functions.
    if(node.type === Syntax.FunctionDeclaration || node.type === Syntax.FunctionExpression) return "avoid-children";
  });
  let newModel: Diffs[] = [];
  for(let k = 0; k < body.length; k++) {
    newModel[k] = DDClone({up: 0, down: cons_(k + "", undefined)});
  }
  for(let defi in localDefinitions) {
    newModel.unshift(localDefinitions[defi]);
  }
  for(let decl in localVars) {
    newModel.unshift(localVars[decl]);
  }
  return newModel;
}

function reverseArray(arr) {
  var newArray = [];
  for (var i = arr.length - 1; i >= 0; i--) {
    newArray.push(arr[i]);
  }
  return newArray;
}

/*
prog: {a: { b: 1}, c: [2, 2], d: 3}
model: {a: {__clone__: "c"}, c: {__clone__: ["a", "b"]}, d: {__clone__: "c"}}
reverseModel: {a: {b: {__clone__: "c"}}, c: {__clone__: "a", __clone__2: "d"}, d: 3}
subProg: {a: [2, 2], c: 1, d: [2, 2]}
uSubProg: {a: [3, 2], c: 4, d: [2, 5]}
uSubDiffs: DDReuse({a: DDReuse({0: DDNewValue(3)}), c: DDNewValue(4), d: DDReuse({1: DDNewValue(5)})})
Expected uProg: {a: {b: 4}, c: [3, 5], d: 3}
Expected uDiffs: DDReuse({a: DDReuse({b: DDNewValue(4)}), c: DDReuse({0: DDNewValue(3), 1: DDNewValue(5)}))

*/
function update_model(model: any, reverseModel: any, uSubProg: Prog, uSubDiffs: Diffs, callback: (uProg: Prog, uDiffs: Diffs) => UpdateAction): UpdateAction {
  // Let's reverse the sub-prog and sub-diffs, recover the prog and recover the diffs.
  console.log(model)
  console.log(reverseModel)
  console.log(uSubProg)
  console.log(uSubDiffs)
  throw "Implement me: update_model"
}

function UpdateRewrite(prog: Prog, model_subProg: Diffs, updateData: UpdateData): UpdateAction {
  console.log("original prog")
  console.log(uneval_(prog, ""))
  let rewriteModel_subprog = copy(prog);
  console.log("rewrite model")
  console.log(uneval_(model_subProg, ""))/**/
  let subProg = applyDiffs1(prog, model_subProg);
  /**/
  console.log("Rewritten program");
  console.log(uneval_(subProg, ""));/**/
  return UpdateContinue(subProg, updateData,
    function(uSubProg, subDiffs, subProg): UpdateAction {
      return update_model(model_subProg, rewriteModel_subprog, uSubProg, subDiffs, (uProg, uDiffs) => UpdateResult(uProg, uDiffs, prog));
    });
}

// Update.js is generated by Update.ts
function getUpdateAction(prog: Prog, updateData: UpdateData): UpdateAction {
  /*if(prog.node.update) { // In case there is a custom update procedure available.
    return prog.node.update{prog, diff};
  }*/
  var Syntax = syntax.Syntax || esprima.Syntax;
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  if(!prog.stack) { // Nothing to update, something must be wrong.
    return UpdateFail("Cannot update empty stack. What's wrong?");
  }
  let stack = prog.stack;
  let computations = stack.computations;
  let currentComputation: Computation = computations.head;
  console.log("currentComputation")
  console.log(currentComputation)
  if(currentComputation.ctor === ComputationType.Node) {
    let oldNode = currentComputation.node;
    if(!("env" in currentComputation)) {
      console.log(prog);
      return UpdateFail("[Internal Error] Environment not found at this point. See console for more details.");
    }
    let env = currentComputation.env;
    let remainingComputations = computations.tail; // Pops the computations
    switch(oldNode.type) {
    case Syntax.Program:
      let script: Node.Script = oldNode as Node.Script;
      let bodyModelDiff: Diffs[] = hoistedDeclarationsDefinitions(script.body, /*declarations*/true);
      bodyModelDiff = bodyModelDiff.map((nodeModel, i) => 
          i === 0 ? DDNewObject({ node: DDMapDownPaths(p => cons_("head", cons_("node", cons_("body", p))), nodeModel),  env: DDClone(["head", "env"])},
                                {ctor: ComputationType.Node, node: undefined, env: undefined}) :
                    DDNewObject({ node: DDMapDownPaths(p => cons_("head", cons_("node", cons_("body", p))), nodeModel)},
                                {ctor: ComputationType.Node, node: undefined})
        );
      let bodyModelListDiffs: Diffs = DDClone(["tail"]);
      for(let i = bodyModelDiff.length - 1; i >= 0; i--) {
        bodyModelListDiffs = DDNewObject({head: bodyModelDiff[i], tail: bodyModelListDiffs});
      }
      // Now we insert each node of bodyModel as a new computation
      let progModel = DDReuse({stack: DDReuse({computations: bodyModelListDiffs})})
      return UpdateRewrite(prog, progModel, updateData);
    case Syntax.AssignmentExpression:
      return UpdateFail("TODO - Implement me (AssignmentExpression)");
    case Syntax.VariableDeclaration:
      let varDecls = (oldNode as Node.VariableDeclaration);
      let isLet =  varDecls.kind === "let";
      if(isLet || varDecls.kind === "const") {
        // TODO: Duplicate the effect of each let so that it first declares the variables
        // and then assign them. Else no recursion possible!
        //const = introduce environment variables
        //let = will wrap these environment variables by references.
        //No need to compute value at this point.
        let newEnv = env;
        let newHeap: Heap = prog.heap;
        let isFirst = true;
        // First allocate a reference in the environemnt pointing to nothing.
        for(let decl of reverseArray(varDecls.declarations)) {
          if(typeof decl.id.name !== "string") return UpdateFail("TODO - Implement me (complex patterns)");
          let newRef = uniqueRef(decl.id.name); // TODO: 
          newHeap = copy(
            newHeap,
            { [newRef] : {__with__: {
                  ctor: HeapValueType.Raw,
                  value: undefined
                }
             }}, {__reuse__: true});
          newEnv = cons_(
            { name: decl.id.name,
              value: { ctor: ValueType.Ref, name: newRef }
            }, newEnv);
        }
        // Now rewrite all initializations as assignments.
        for(let decl of reverseArray(varDecls.declarations)) {
          var rewrittenNode = new Node.AssignmentExpression(
            decl.wsBeforeEq, "=", decl.id,  decl.init === null ? decl.id : decl.init
          );
          rewrittenNode.wsBefore = decl.wsBefore;
          rewrittenNode.wsAfter = decl.wsAfter;
          remainingComputations = { head: {ctor: ComputationType.Node, env: env, node: rewrittenNode}, tail: remainingComputations };
        }
        if(typeof remainingComputations !== "undefined") {
          // We propagate the environment to the next stack element
          remainingComputations = copy(remainingComputations,
          { head: { env: {__with__: newEnv} }}, {__reuse__: true});
        }
        let subProg = copy(prog, {stack: {computations: {__with__: remainingComputations} }}, {__reuse__: true});
        return UpdateContinue(subProg, updateData,
          function(uSubProg: Prog, subDiffs: Diffs, subProg: Prog):UpdateAction {
            return UpdateFail("TODO: Implement me (let/const)");
            // TODO: Recover definitions and the program shape.
          });
      } else if(varDecls.kind === "var") {
        //var = just unroll as variable assignments
        for(let decl of reverseArray(varDecls.declarations)) {
          var rewrittenNode = new Node.AssignmentExpression(
            decl.wsBeforeEq, "=", decl.id,  decl.init === null ? decl.id : decl.init
          );
          rewrittenNode.wsBefore = decl.wsBefore;
          rewrittenNode.wsAfter = decl.wsAfter;
          remainingComputations = { head: {ctor: ComputationType.Node, env: env, node: rewrittenNode}, tail: remainingComputations };
        }
        let subProg = copy(prog, { stack: {computations: remainingComputations}}, {__reuse__: true});
        return UpdateContinue(subProg, updateData,
          function(uSubProg: Prog, subDiffs: Diffs, prog: Prog):UpdateAction {
          throw "TODO: Implement me (var)"
            // TODO: Reconstruct program and diffs from rewriting
          }
        );
      } else return UpdateFail("Unknown variable declaration kind: " + varDecls.kind);
    case Syntax.ExpressionStatement:
      // We compute heap modifications. Only if currentComputation marked with returnedExpressionStatement = true can we propagate updateData to the expression.
      // propagate environment to the next statement
      if(typeof remainingComputations !== "undefined") {
        remainingComputations = copy(remainingComputations,
          { head: {env: {__with__: env}}}, {__reuse__: true});
      }
      let expStatement = oldNode as Node.ExpressionStatement;
      if(currentComputation.returnedExpressionStatement) {
        // Add the expression to the stack.
        remainingComputations = { head:  {ctor: ComputationType.Node, env: env, node: expStatement.expression}, tail: remainingComputations };
        let subProg = copy(
          prog,
          { stack: {__with__: remainingComputations} },
          {__reuse__: true});
        return UpdateContinue(subProg, updateData,
          function(uSubProg: Prog, subDiffs: Diffs, prog: Prog):UpdateAction {
            let updatedNode = new Node.ExpressionStatement((uSubProg.stack.computations.head as ComputationNode).node, (oldNode as Node.ExpressionStatement).semicolon);
            updatedNode.wsBefore = (oldNode as Node.ExpressionStatement).wsBefore;
            updatedNode.wsAfter = (oldNode as Node.ExpressionStatement).wsAfter;
            let updateDiffs = DDMap(["stack", "head", "node"], subDiffs, d => DDChild("expression", d));
            return UpdateResult(
            copy(prog,
            {stack: { computations: { head: { node: {__with__: updatedNode}}}}}, {__reuse__: true}),
            updateDiffs, prog);
          }
        )
      } else {
        throw "TODO: Implement me (ExpressionStatement)"
        /*
        // No back-propagation at this point. We just move on but the heap is now a reference in case we need it.
        let subProg = {...prog,
          heap: // TODO
          ,
        stack: remainingComputations};
        return UpdateContinue(subProg, updateData,
        function(uSubProg: Prog, subDiffs: Diffs, prog: Prog):UpdateAction {
          // TODO: Reconstruct Expression statement and diffs.
          throw "TODO: Implement me (ExpressionStatement)"
        });*/
      }
    case Syntax.Literal: // Literals can be replaced by clones
      // TODO: Make sure this is correct. Make the stack to work.
      return processClones(prog, updateData, (diff: DUpdate) => {
        let newDiffs = DDChild(["stack", "head", "node", "value"], DDNewValue(updateData.newVal)); // TODO: What about string diffs?
        let newNode = copy(oldNode) as Node.Literal;
        newNode.value = updateData.newVal;
        return UpdateResult(copy(prog,
          {stack: { computations: { head: {node: {__with__: newNode}}, tail: {__with__: remainingComputations }}}}), newDiffs, prog);
      });
    case Syntax.Identifier:
      throw "TODO: Identifier"
      
    // Updates the environment, or the heap.
      // TODO: Immediately update expression. Will merge expressions later in any case.
      /*var newEnv = updateVar_(prog.env, (oldNode as Node.Identifier).name, function(oldValue: EnvValue): EnvValue {
        return {v_: updateData.newVal,
                expr: oldValue.expr, // TODO: Update this expression as well !
                env: oldValue.env};
      });
      // Process clone expressions first (i.e. change shape of program)
      return UpdateAlternative(
        processClones(prog, updateData),
        UpdateResult({...prog, env: newEnv, diffs: DDSame()}, prog));*/
      /*
      let id = oldNode as Node.Identifier;
      let name = id.name;
      // Either in environment, or replace by global.name.
      let relevantEnv = env;
      console.log(env.head);
      let moreRecentUntouchedEnv: Env = undefined;
      while(relevantEnv && relevantEnv.head.name !== name) {
        moreRecentUntouchedEnv = { head: relevantEnv.head, tail: moreRecentUntouchedEnv };
        relevantEnv = relevantEnv.tail;
      }
      if(!relevantEnv) {
        throw "TODO: Implement me (global identifier)";
      }
      let binding = relevantEnv.head.value;
      let varProg: Prog = {
        context: [], // We do not consider the context where the variable is used.
        stack: {
          values: 
          computations: {
            head: {
              ctor: ComputationType.Node,
              env: binding.env,
              node: binding.expr
            },
            tail: remainingComputations}
          }
        heap: binding.heap
      }
      return UpdateContinue(varProg, updateData,
        function(updatedVarProg, varProg) {
          let [updatedBinding, updatedBindingDiffs]: [ComputationSource, Diffs] = 
            DDRewrite(
              {env: {__clone__: ["stack", "head", "env"]},
               expr: {__clone__: ["stack", "head", "node"]},
               heap: {__clone__: ["heap"]}
               }, updatedVarProg, updatedVarProg.diffs
            );
          let updatedEnv =
            List.reverseInsert(moreRecentUntouchedEnv,
            {head: {name: name, value: updatedBinding}, tail: relevantEnv.tail});
          let updatedEnvDiffs =
            DDChild(array_repeat("tail", List.length(moreRecentUntouchedEnv)).concat(
              ["head", "value"]), updatedBindingDiffs);
          let updatedDiffs: Diffs = 
            DDReuse({head: DDChild("env", updatedEnvDiffs),
                     tail: DDExtract(["stack", "tail"], updatedVarProg.diffs)});
          return UpdateResult({
            context: prog.context,
            stack: { head: {ctor: ComputationType.Node, env: updatedEnv, node: oldNode}
                   , tail: updatedVarProg.stack.tail},
            heap: prog.heap,
            diffs: updatedDiffs
          }, prog);
        });
      throw "TODO: Implement me (local identifier)";
      */
      
    case Syntax.ReturnStatement:
      // We can update its expression with updateData.
      
      throw "TODO: Implement me (ReturnStatement)"
    case Syntax.ArrayExpression:
      // For arrays of size 2 where
      // - the second node is an object
      // - and the first one is a string
      // it is possible to push back a string (the object is copied)
      // This should have been take care of before.
      //var subExpressions = oldNode.
      //return ;
      // When there will be a heap, elements can modify the heap; in this case, we should
      // treat every sub-expression as an assignment,
      // For now let's suppose they don't.
      if(typeof updateData.newVal == "string" || typeof updateData.newVal == "number") {
        // Check the diff: Maybe it's a cloned value, e.g. unwrapped?
        return UpdateAlternative(...updateData.diffs.map( function(diff) {
          if(diff.ctor === DType.Update && diff.kind.ctor == DUType.Reuse && !isIdPath(diff.kind.path)) {
            return processClone(prog, updateData.newVal, updateData.oldVal, diff);
          } else {
            let newNode = new Node.Literal(oldNode.wsBefore, updateData.newVal, uneval_(updateData.newVal)); // TODO: What about string diffs?
            return UpdateResult(copy(prog,
              { stack: { computations: {
              head: { node: {__with__: newNode}}}}}, {__reuse__: true}),
              DDChild(["stack", "computations", "head", "node"], DDNewNode(newNode)), prog);
          }
        }));
      }
      return processClones(prog, updateData, (diff: DUpdate) => {
        var elements: AnyNode[] = (oldNode as Node.ArrayExpression).elements;
        let newNode: Node.ArrayExpression;
        let newDiffs: DUpdate[];
        if(diff.kind.ctor === DUType.Reuse) {
          newNode = copy(oldNode as Node.ArrayExpression);
          newDiffs = DDReuse({elements: DDSame()});
          return updateForeach((prog.stack.computations.head as ComputationNode).env, elements, 
            (element, k) => callback => 
              typeof diff.children[k] != "undefined" ?
                UpdateContinue(
                  copy(prog, { context: { __with__: [oldNode].concat(prog.context)},
                  stack: {computations: { head: {node: {__with__: element}}}}}, {__reuse__: true}),
                  {newVal: (updateData.newVal as any[])[k],
                   oldVal: (updateData.oldVal as any[])[k],
                   diffs: diff.children[k]}, callback) :
                UpdateResult(
                  prog, DDSame(), prog, callback),
            arrayGather(prog, newNode, newDiffs));
        } else {
          return UpdateFail("Don't know how to handle this kind of diff on arrays: " + diff.kind.ctor);
        }
      });
    default:
      return UpdateFail("Reversion does not currently support nodes of type " + oldNode.type);
    }
  }
  return UpdateFail("Reversion does not support this current stack element: " + currentComputation.ctor);
}

// Find all paths from complexVal to simpleVal if complexVal contains simpleVal
function allClonePaths_(complexVal: any, simpleVal: any): Path[] {
  if(uneval_(simpleVal) === uneval_(complexVal)) return [{ up: 0, down: undefined}];
  if(typeof complexVal == "object") {
    let diffs = [];
    for(let k in complexVal) {
      diffs.push(...allClonePaths_(complexVal[k], simpleVal).map(p => {
        p.down = cons_(k, p.down);
        return p;
      }));
    }
    return diffs;
  }
  return [];
}

function isRichText_(value: any) {
  return typeof value == "object" &&
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] == "string" &&
    typeof value[1] == "object" &&
    !Array.isArray(value[1]);
}

function isElement_(value: any) {
  return typeof value == "object" &&
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] == "string" &&
    typeof value[1] == "object" &&
    !Array.isArray(value[1]) &&
    typeof value[2] == "object" &&
    Array.isArray(value[2]);
}

function isSimpleChildClone(d: Diff): boolean {
  return d.ctor == DType.Update && d.kind.ctor == DUType.Reuse && d.kind.path.up === 0 && List.length(d.kind.path.down) == 1;
}

// Later, we could include the context while computing diffs to recover up clones.
function computeDiffs_(oldVal: any, newVal: any): Diffs {
  let o: string = typeof oldVal;
  let n: string = typeof newVal;
  if(o == "function" || n == "function") {
    return []; // Cannot diff functions
  }
  function addNewObjectDiffs(diffs: Diffs): Diffs {
    let childDiffs: ChildDiffs = {};
    let model: any = Array.isArray(newVal) ? Array(newVal.length) : {};
    let lastClosestOffset: number = 0;
    for(var key in newVal) {
      if(typeof oldVal == "object" && lastClosestOffset == 0 &&
         uneval_(oldVal[key]) == uneval_(newVal[key])) {
        // Same key, we try not to find fancy diffs with it.
        childDiffs[key] = DDClone(key);
      } else {
        var cd = computeDiffs_(oldVal, newVal[key]);
        if(cd.length == 1 && cd[0].ctor == DType.Update && (cd[0] as DUpdate).kind.ctor == DUType.NewValue && Object.keys((cd[0] as DUpdate).children).length == 0) {
          model[key] = ((cd[0] as DUpdate).kind as {model: any}).model;
        } else {
          if(cd.length >= 1 && isSimpleChildClone(cd[0])) {
            // Here we should remove everything else which is not a clone, as we are just moving children around the object.
            cd = cd.filter(d => isSimpleChildClone(d)) as DClone[];
            if(Array.isArray(newVal)) {
              // The most likely clones are those whose key is close to the original one.
              // TODO: For deletions and insertions, compute an offset to change this key.
              let nKey = parseInt(key);
              (cd as DClone[]).sort(function(d1, d2) {
                return Math.abs(parseInt(d1.kind.path.down[0] + "") - nKey - lastClosestOffset) -
                       Math.abs(parseInt(d2.kind.path.down[0] + "") - nKey - lastClosestOffset);
              });
              lastClosestOffset = parseInt((cd[0] as DClone).kind.path.down[0] + "") - nKey;
            };
            //cd.length = 1;
          }
          childDiffs[key] = cd;
        }
      }
    }
    diffs.push(...DDNewObject(childDiffs, model));
    return diffs;
  }
  if(o == "number" || o == "boolean" || o == "string") {
    if(n == "boolean" || n == "number" ||
     n == "string") {
      if(oldVal === newVal)
        return DDSame();
      // if(n == "string") // TODO: String diffs
      return DDNewValue(newVal);
    } else if(n == "object" ) { // maybe the number was included in the object/array
      return addNewObjectDiffs([]);
    }
  } else if(o == "object") {
    if(n == "number" || n == "string" || n == "boolean") {
      // It could have been cloned from one of the object's descendent.
      let clonePaths = allClonePaths_(oldVal, newVal);
      let diffs: Diffs = [];
      for(let c in clonePaths) {
        diffs.push(...DDClone(clonePaths[c]));
      }
      diffs.push(...DDNewValue(newVal));
      // WISH: Sort diffs according to relevance
      return diffs;
    }
    if(n == "object") {
      // It might be possible that objects are also wrapped or unwrapped from other objects, e.g.
      // n: ["img", {}, []] ->
      // o: ["p", {}, ["img", {}, []]];
      // We want to detect that.
      let diffs = [];
      let sameKeys = uneval_(Object.keys(newVal)) == uneval_(Object.keys(oldVal));
      if(sameKeys) { // Check if they are compatible for reuse
        if(uneval_(newVal) == uneval_(oldVal)) {
          return DDSame();
        }
        if(isRichText_(newVal) && isRichText_(oldVal) || isElement_(newVal) && isElement_(oldVal) && newVal[0] == oldVal[0] || !isRichText_(newVal) && !isRichText_(oldVal) && !isElement_(newVal) && !isElement_(oldVal) && Array.isArray(oldVal) == Array.isArray(newVal)) {
          let childDiffs: ChildDiffs = {};
          for(let k in oldVal) {
            let oldValChild = oldVal[k];
            let newValChild = newVal[k];
            if(uneval_(oldValChild) != uneval_(newValChild))
              childDiffs[k] = computeDiffs_(oldValChild, newValChild)
          }
          diffs.push({ctor: DType.Update, kind: {ctor: DUType.Reuse}, children: childDiffs});
        }
      }
      // Now check if the new value was unwrapped
      let unwrappingPaths = allClonePaths_(oldVal, newVal);
      for(let c in unwrappingPaths) {
        diffs.push(...DDClone(unwrappingPaths[c]));
      }
      // Now let's create a new object or array and obtain the children from the original.
      // Values might be wrapped that way.
      return addNewObjectDiffs(diffs);
    }
  }
  // Symbols
  return [];
}

type Update_Result = {env: Env, node: String, next: () => Update_Result | undefined};

// Given the old formula and the new value, try to generate a new formula.
// If fails, return false
// update_: (Env, StringFormula) -> StringValue -> (Ok([Env (updated with flags), StringFormula]) | Err(msg))
function update_(env, oldFormula): (newVal: any) => Res<string, Update_Result> {
  /*addUpdateMethods();*/
  var oldNode = esprima.parseScript(oldFormula);
  var oldVal = evaluate_(env, oldFormula);
  
  return function(newVal: any):Res<string, Update_Result> {
    var diffs = computeDiffs_(oldVal, newVal);
    /*
    console.log("computeDiffs_(" + uneval_(oldVal) + ", " + uneval_(newVal) + ")");
    console.log(uneval_(diffs, ""));
    //*/
    return formatUpdateResult(
      UpdateContinue(initProg(oldNode, env),
        {newVal: newVal, oldVal: oldVal, diffs: diffs}));
  }
}

function formatUpdateResult(updateAction, callbacks?, forks?): Res<string, Update_Result> {
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  var updated = processUpdateAction(updateAction, callbacks, forks);
  return resultCase(updated, function(x) { return Err(x); },
    function(progWithAlternatives: ProgWithAlternatives): Res<string, Update_Result> {
      let headNode = progWithAlternatives.prog.stack.computations.head as ComputationNode;
      var uResult = {
        env: headNode.env,
        node: Node.unparse(headNode),
        next() {
          if(progWithAlternatives.alternatives.length == 0) return undefined;
          var fork = progWithAlternatives.alternatives[0];
          var remainingForks = progWithAlternatives.alternatives.slice(1);
          var action = fork.action;
          var callbacks = fork.callbacks;
          var r = formatUpdateResult(action, callbacks, remainingForks);
          var result = r.ctor == "Err" ? undefined : r._0;
          uResult.next = (result => () => result)(result);
          return result;
        }
      };
      return Ok<Update_Result>(uResult);
    }
  )
}

function testUpdate() {
  Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
