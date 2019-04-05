import * as syntax from './syntax';
import * as Node from './nodes';
import * as esprima from './esprima';

type Ok<a> = { ctor: 'Ok', _0: a}
type Err<a> = { ctor: 'Err', _0: a}
type Res<err,ok> = Err<err> | Ok<ok> 
declare function Ok<a>(arg: a): Ok<a>;
declare function Err<a>(arg: a): Err<a>;
declare function resultCase<err,ok,a>(arg: Res<err,ok>, cb1: ((e: err) => a), cb2: ((o: ok) => a)): a;

enum HeapValueType {
  Raw = "Raw",
  Array = "Array",
  Object = "Object",
  Function = "Function",
  Ref = "Ref"
}
type HeapLocation = string
interface Heap {
  [loc: string]: HeapValue
}
enum HeapSourceType {
  Direct = "Direct",
  After = "After"
}
type HeapSource =
    {tag: HeapSourceType.Direct, heap: Heap}
  | {tag: HeapSourceType.After, source: ComputationSource, heap?: Heap}

// When a value was computed, what led to computing it?
// Diffs for ComputationSource is always a Reuse specifying individual diffs for Env, expr and heapSource.
type ComputationSource = {
  env: Env,
  expr: AnyNode,
  heapSource: HeapSource,
  v_?: any, ref?: HeapLocation, // Two values computed on demand
  heapAllocated?: boolean, // true if the computed value should be wrapped by a reference (even if it is a reference), in which case ref contains the reference
  diffs?: Diffs }
// v_ = Value after all dereferencing
type HeapValue = {tag: HeapValueType.Raw, value?: string | number | boolean | undefined, source: ComputationSource}
               | {tag: HeapValueType.Array, value?: HeapLocation[], source: ComputationSource}
               | {tag: HeapValueType.Object, value?: {[key: string]: HeapLocation}, source: ComputationSource}
               | {tag: HeapValueType.Function, // We shouldn't need the closure to update it.
                    value: {name: string | undefined,
                            thisBinding: HeapValue | undefined,
                            properties: {[key: string]: HeapLocation} // Additional run-time properties
                           }, source: ComputationSource}
               | {tag: HeapValueType.Ref, value: HeapLocation, source: ComputationSource}
type Env = undefined | { head: {name: string, value: ComputationSource}, tail: Env}
type EnvValue = { v_: any, source: ComputationSource}

type Stack = undefined | { head: StackValue, tail: Stack}
enum StackValueType {
  //Argument = "Argument", // next argument to compute
  //Call = "Call",
  //Primitive = "Primitive",
  Node = "Node" // When processed, before adding to stack, adds the env to the next NodeWithoutEnv in the stack.
}
type StackValue =
//    { tag: StackValueType.Argument, env: Env, argument: AnyNode} // The heap is obtained after computing the function.
//  | { tag: StackValueType.Call, env: Env }
//  | { tag: StackValueType.Primitive, env: Env, name: string}
      { tag: StackValueType.Node, env?: Env, node: AnyNode, returnedExpressionStatement?: boolean }
      // Returned mean that if the node is an expressionStatement, its value can be updated.
      // If the env is not there yet, it is added when the previous statement is processed.

function initStack(env: Env, initNode: AnyNode): Stack {
  return {head: {tag: StackValueType.Node, env: env, node: initNode}, tail: undefined};
}
function initEnv(): Env {
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  return {head: // Global this object available
    { name: "this",
      value: { env: undefined,
               expr: new Node.Identifier("", "this", "this"),
               heapSource: {
                 tag: HeapSourceType.Direct,
                 heap: initHeap()},
               v_: {},
               ref: "this" } as ComputationSource },
    tail: undefined }
}
// Equivalent of:
//     const this = {}
// Heap used once in initEnv, and another time in initStack
// Perhaps we should consider just rewriting the initial program?
function initHeap(): Heap {
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  return { ["this"]: {tag: HeapValueType.Object, value: {}, source: {env: undefined, expr: new Node.ObjectExpression("", [], [], ""), heapSource: {tag: HeapSourceType.Direct, heap: {}}}} }
}
function initHeapSource(): HeapSource {
  return {tag: HeapSourceType.Direct, heap: initHeap()};
}
// Converts a node/environment to an initial program
function initProg(node: AnyNode, env: Env = initEnv()): Prog {
  return {context: [], stack: initStack(env, node), heapSource: initHeapSource()}
}

var uniqueID = 0;
function uniqueRef(name) {
  return name + (uniqueID++);
}

// TODO: This function should return an UpdateAction to actually update the variable's value.
declare function updateVar_(env: Env, name: string, cb: (oldv: EnvValue) => EnvValue): Env
type AnyNode = Node.ExportableDefaultDeclaration// & { update?: (prog: Prog, newVal: UpdateData) => UpdateAction }
type Prog = {
  context: AnyNode[], // Expression context (for clones)
  heapSource: HeapSource, // Indirect or direct binding from heap locations to computation sources
  stack: Stack}      // Stack of remaining operations. Initially a initStack(program). Each stack element may or may not contain an environment
type ProgDiffs = Prog & { diffs: Diffs }
type UpdateData = {newVal: any, oldVal: any, diffs?: Diffs}
declare let Logger: { log: (content: any) => any };
declare function mergeUpdatedEnvs(env1: Env, env2: Env): Res<string,Env>;
declare function uneval_(x: any, indent?: string): string
declare function buildEnvJS_(env: Env): any
declare function evaluate_(env: Env, $$source$$$: string): any
declare function newCall(s: string, args: any[]): any

enum DType {
    Clone = "Clone",
    Update = "Update"
};
enum DUType {
  Reuse = "Reuse",
  NewValue = "NewValue",
};
type DUKindNew = 
  {ctor: DUType.NewValue, model: any};
type DUKind =
  {ctor: DUType.Reuse} | DUKindNew;
interface ChildDiffs {
  [key: string]: Diffs
}
type Path = { up: number, down: (string | number)[] };
type DUpdate = { ctor: DType.Update, kind: DUKind, children: ChildDiffs };
type DUpdateReuse = { ctor: DType.Update, kind: {ctor: DUType.Reuse}, children: ChildDiffs }
type DClone = { ctor: DType.Clone, path: Path, diffs: Diffs };
type Diff = DUpdate | DClone;
type Diffs = Diff[];

function DDReuse(childDiffs: ChildDiffs): DUpdate[] {
  return [{
    ctor: DType.Update,
    kind: {ctor: DUType.Reuse },
    children: childDiffs
  }];
}
function DDChild(name: string[] | string, childDiffs: Diffs): Diffs {
  if(typeof name === "string") {
    return DDReuse({[name]: childDiffs})
  } else {
    if(name.length == 0) return childDiffs;
    return DDChild(name[0], DDChild(name.slice(1), childDiffs));
  }
}
function DDWrap(name: string[] | string, diffs: Diffs, diffUpdater: (ds: Diffs) => Diffs): Diffs {
  if(typeof name === "string") {
    return diffs.map(diff =>
      diff.ctor === DType.Update ?
          {...diff, children: {...diff.children,
          [name]: diffUpdater(diff.children[name])}}
        : diff
    )
  } else {
    if(name.length == 0) return diffUpdater(diffs);
    return DDWrap(name[0], diffs, d => DDWrap(name.slice(1), d, diffUpdater));
  }
}
function DDNewValue(newVal: any): DUpdate[] {
  return [{ctor: DType.Update, kind: {ctor: DUType.NewValue, model: newVal}, children: {}}];
}
function DDNewObject(children: ChildDiffs, model = {}): DUpdate[] {
  return [{ctor: DType.Update, kind: {ctor: DUType.NewValue, model: model}, children: children}];
}
function DDNewArray(length: number, children: ChildDiffs): DUpdate[] {
  return [{ctor: DType.Update, kind: {ctor: DUType.NewValue, model: Array(length)}, children: children}];
}
function DDNewNode(model: any, children = {}): DUpdate[] {
  return [{ctor: DType.Update, kind: {ctor: DUType.NewValue, model: model}, children: children}]
}
function DDClone(path: Path, diffs: Diffs): DClone[] {
  return [{ctor: DType.Clone, path: path, diffs: diffs}];
}
function DDSame(): Diffs {
  return [{ctor: DType.Update, kind: {ctor: DUType.Reuse}, children: {}}];
}

enum UType {
    Result,
    Continue,
    Fail,
    CriticalError,
    Alternative
}

type UpdateCallback = (newProg: ProgDiffs, oldProg: Prog) => UpdateAction
type UpdateResult = {ctor: UType.Result, newProg: ProgDiffs, oldProg: Prog, callback: undefined | UpdateCallback};
type UpdateFail = {ctor: UType.Fail, msg: string};
type UpdateCriticalError = {ctor: UType.CriticalError, msg: string};
type UpdateContinue = {ctor: UType.Continue, prog: Prog, updateData: UpdateData, callback: undefined | UpdateCallback};
type UpdateAlternative = { ctor: UType.Alternative, alternatives: UpdateAction[]};
type UpdateAction = UpdateFail | UpdateCriticalError | UpdateResult | UpdateContinue | UpdateAlternative;
type Fork = {action: UpdateAction, callbacks: UpdateCallback[]};
type ProgWithAlternatives = {prog: ProgDiffs, alternatives: Fork[] };

function UpdateContinue(p: Prog, n: UpdateData, c?: UpdateCallback): UpdateContinue {
  return {ctor: UType.Continue, prog: p, updateData: n, callback: c};
}
function UpdateResult(p: ProgDiffs, oldP: Prog, c?: UpdateCallback): UpdateResult {
  return {ctor: UType.Result, newProg: p, oldProg: oldP, callback: c};
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
      action = callbacks.pop()(action.newProg, action.oldProg);
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
  return Ok({prog: action.newProg, alternatives: forks});
}

function isDSame(diffs) {
  return diffs.length === 1 && diffs[0].ctor === DType.Update && diffs[0].kind === DUType.Reuse &&  diffs[0].children.length === 0;
}

// TODO: Incorporate custom path map.
function processClone(prog: Prog, newVal: any, oldVal: any, diff: DClone, callback?: UpdateCallback): UpdateAction {
  var Syntax = syntax.Syntax || esprima.Syntax;
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  if(diff.path.up <= prog.context.length) {
    let oldNode = prog.stack.head.node;
    var toClone: AnyNode = diff.path.up == 0 ? oldNode : prog.context[diff.path.up - 1];
    var nodePathDown = [];
    for(let downpathelem of diff.path.down) { // We map down path elems to AST
      if(toClone && toClone.type == Syntax.ArrayExpression && typeof (toClone as Node.ArrayExpression).elements[downpathelem] != "undefined") {
        nodePathDown.push("elements");
        nodePathDown.push(downpathelem);
        toClone = (toClone as Node.ArrayExpression).elements[downpathelem];
      } else
        return UpdateFail("Cloning path not supported for " + downpathelem + " on " + (toClone ? toClone.type : " empty path"));
    }
    if(isDSame(diff.diffs)) {
      return UpdateResult({...prog,
        stack: { head: {...prog.stack.head, node: Object.create(toClone)},
        tail: prog.stack.tail},
        diffs: DDChild(["stack", "head", "node"], DDClone({up: diff.path.up, down: nodePathDown}, DDSame()))}, prog, callback)
    } else {
      return UpdateContinue({...prog,
        stack: { head: {...prog.stack.head, node: Object.create(toClone)},
        tail: prog.stack.tail},
      }, {newVal: newVal, oldVal: oldVal, diffs: diff.diffs},
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
    if(diff.ctor === DType.Clone) {
      if(diff.path.up != 0)
        newDiffs.push(diff);
      continue;
    }
    var newChildrenDiffs: ChildDiffs = {};
    for(let key in diff.children) {
      var newChildDiffs = filterDiffsNoClonesDown(diff.children[key]);
      if(newChildDiffs.length == 0) willBeEmpty = true;
      newChildDiffs[key] = newChildDiffs;
    }
    newDiffs.push({...diff, children: newChildrenDiffs});
  }
  if(willBeEmpty) return [];
  return newDiffs;
}

function processClones(prog: Prog, updateData: UpdateData,
     otherwise?: (diff: DUpdate) => UpdateAction ): UpdateAction {
  var Syntax = syntax.Syntax || esprima.Syntax;
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  return UpdateAlternative(...updateData.diffs.map(function(diff: Diff): UpdateAction {
    let oldNode = prog.stack.head.node;
    if(diff.ctor === DType.Clone) {
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
          {...prog,
           stack: {...prog.stack,
             head: {...prog.stack.head,
             node: newChildVal}},
            diffs: DDChild(["stack", "head", "node"], valToNodeDiffs_(newChildVal))
          }, prog);
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
        return updateForeach(prog.stack.head.env, Object.keys(updateData.newVal),
          k => callback => {
            let newChildVal = updateData.newVal[k];
            let childDiff = diffToConsider.children[k];
            if(typeof childDiff == "undefined") {
              let newChildNode = valToNode_(newChildVal);
              let newChildNodeDiffs = valToNodeDiffs_(newChildVal);
              return UpdateResult({...prog,
                stack: {head: {...prog.stack.head,
                  node: newChildNode
                }, tail: prog.stack.tail},
                diffs: DDChild(["stack", "head", "node"], newChildNodeDiffs)}, prog, callback);
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
      return callbackIterator(elem, i)((newProg: ProgDiffs, oldProg: Prog) => {
        var mergedEnv = mergeUpdatedEnvs(envSoFar, newProg.stack.head.env)._0 as Env;
        return aux(mergedEnv, nodesSoFar.concat(newProg.stack.head.node), diffsSoFar.concat(newProg.diffs), i + 1);
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
      {...prog,
       stack: {
         head: {...prog.stack.head,
           node: newNode,
           env: newEnv
         },
         tail: prog.stack.tail},
      diffs: DDChild(["stack", "head", "node"], newDiffs) },
       prog);
  }
}

function objectGather(prog: Prog, keys: string[], newNode: Node.ObjectExpression, newDiffs: DUpdate[]) {
  return function(newEnv: Env, newNodes: AnyNode[], newNodesDiffs: Diffs[]): UpdateAction {
    keys.map((key, k) => {
      newNode.properties.push(keyValueToProperty(key, newNodes[k] as Node.PropertyValue));
    });
    newDiffs[0].children.properties = DDReuse(newNodesDiffs.map((newNodeDiff) => DDReuse({value: newNodeDiff})) as unknown as ChildDiffs); // FIXME: Not reuse?!
    return UpdateResult(
      {...prog,
        stack: {
         head: {...prog.stack.head,
           node: newNode,
           env: newEnv
         },
         tail: prog.stack.tail},
         diffs: DDChild(["stack", "head", "node"], newDiffs)}, prog);
  }
}
function walkNodes(nodes, preCall?, postCall?, level?) {
  for(let x of nodes) walkNode(x, preCall, postCall, level);
}
var walkers = undefined;
function walkNode(node, preCall?, postCall?, level?) {
  if(typeof walkers == "undefined") {
    var Syntax = syntax.Syntax || esprima.Syntax;
    var rMany = (sub) => (node, preCall, postCall, level) => {
      var children = node[sub];
      if(children == null) return;
      for(let x of node[sub]) {
        let r = walkNode(x, preCall, postCall, level + 1);
        if(typeof r !== "undefined") return r;
    } };
    var rChild = (sub) => (node, preCall, postCall, level) => {
      var child = node[sub];
      if(typeof child !== "undefined")
        return walkNode(child, preCall, postCall, level + 1);
    };
    var rElements = rMany("elements");
    var combine = (...rFuns) => (node, preCall, postCall, level) => {
      for(let rFun of rFuns) {
        if(typeof rFun === "string") rFun = rChild(rFun);
        var x = rFun(node, preCall, postCall, level + 1);
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
      [Syntax.DoWhileStatement]: combine(rBody, "test"),
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
  if(typeof x !== "undefined") return x;
  if(node !== null) {
    var walker = walkers[node.type];
    if(typeof walker === "function") {
      var x = walker(node, preCall, postCall, level);
      if(typeof x !== "undefined") return x;
    }
  }
  var x = postCall ? postCall(node, level) : undefined;
  if(typeof x !== "undefined") return x;
}

// Returns [a list of declarations that will allocate a heap reference -- initially filled with "undefined" (no declarations if declarations = false),
// a list of definitions that have to be hoisted (e.g. function definitions)]
function hoistedDeclarationsDefinitions(body: AnyNode[], declarations = true): [AnyNode[], AnyNode[]] {
  var Syntax = syntax.Syntax || esprima.Syntax;
  var localVars: { [name: string]: Node.VariableDeclaration } = {};
  var localDefinitions: {[name: string]: Node.AssignmentExpression } = {}; 
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  walkNodes(body, (node, level) => {
    // We hoist variable declarations
    if(declarations && node.type === Syntax.VariableDeclaration) {
      for(let declaration of (node as Node.VariableDeclaration).declarations) {
        if(declaration.id.type === Syntax.Identifier) {
          localVars[(declaration.id as Node.Identifier).name] =
            new Node.VariableDeclaration("\n",
              [new Node.VariableDeclarator(
                  declaration.id, " ", new Node.Identifier(" ", "undefined", "undefined"))
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
          new Node.VariableDeclaration("\n",
            [new Node.VariableDeclarator(
              fd.id as Node.Identifier, " ", new Node.Identifier(" ", "undefined", "undefined"))
            ], [], "let", ";");
      }
      if(level == 0) {
        let fe = new Node.FunctionExpression(
              fd.wsBeforeFunction, fd.wsBeforeStar, fd.id, fd.wsBeforeParams,
              fd.params, fd.separators, fd.wsBeforeEndParams, fd.body, fd.generator);
        fe.wsAfter = fd.wsAfter;
        localDefinitions[(fd.id as Node.Identifier).name] =
          new Node.AssignmentExpression(" ","=", fd.id as Node.Identifier, fe);
      }
    }
    // We ignore declarations inside functions of course.
    if(node.type === Syntax.FunctionDeclaration || node.type === Syntax.FunctionExpression) return true;
  });
  var varDeclarations: Node.VariableDeclaration[] = []
  for(let decl in localVars) {
    varDeclarations.push(localVars[decl]);
  }
  var definitions: Node.AssignmentExpression[] = []
  for(let defi in localDefinitions) {
    definitions.push(localDefinitions[defi]);
  }
  return [varDeclarations, definitions];
}

function reverseArray(arr) {
  var newArray = [];
  for (var i = arr.length - 1; i >= 0; i--) {
    newArray.push(arr[i]);
  }
  return newArray;
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
  var stackHead = stack.head;
  if(stackHead.tag = StackValueType.Node) {
    var oldNode = stackHead.node;
    if(!("env" in stackHead)) {
      console.log(prog);
      return UpdateFail("[Internal Error] Environment not found at this point.")
    }
    var env = stackHead.env;
    let newStack = stack.tail; // Pop the stack
    switch(oldNode.type) {
    case Syntax.Program:
      let script: Node.Script = oldNode as Node.Script;
      if(script.body.length == 0) {
        return UpdateFail("Cannot update empty script")
      }
      let [declarations, definitions] = hoistedDeclarationsDefinitions(script.body, /*declarations*/true);
      let isFirst = true;
      for(let statement of reverseArray(declarations.concat(definitions.concat(script.body)))) {
        newStack = {head: {tag: StackValueType.Node, node: statement}, tail: newStack};
        if(isFirst) {
          newStack.head.returnedExpressionStatement = true;
          isFirst = false;
        }
      }
      newStack = { head: {...newStack.head, env: env}, tail: newStack };
      return UpdateContinue({...prog, stack: newStack}, updateData,
        function(newX: ProgDiffs, oldX: Prog): UpdateResult {
          console.log(newX.stack.head);
          throw "TODO: Implement me (Program)"
          // TODO: Reconstruct the original modified program here and its diff
        });
    case Syntax.AssignmentExpression:
    
      return;
    case Syntax.VariableDeclaration:
      let varDecls = (oldNode as Node.VariableDeclaration);
      let isLet =  varDecls.kind === "let";
      if(isLet || varDecls.kind === "const") {
        //const = introduce environment variables
        //let = will wrap these environment variables by references.
        //No need to compute value at this point.
        let newEnv = env;
        let heapSource = undefined;
        let isFirst = true;
        let lastComputationSource: ComputationSource | undefined;
        for(let decl of reverseArray(varDecls.declarations)) {
          if(isFirst) {
            heapSource = prog.heapSource;
            isFirst = false;
          } else {
            heapSource = {tag: HeapSourceType.After, source: lastComputationSource as ComputationSource };
          }
          lastComputationSource = {
            env: newEnv,
            expr: decl.right as Node.Expression,
            heapSource: heapSource,
            heapAllocated: isLet
          };
          newEnv = {
            head: {name: decl.id.name, value: lastComputationSource},
            tail: newEnv
          };
        }
        if(typeof newStack !== "undefined") {
          // We propagate the environment to the next stack element.
          newStack = { head: {...newStack.head, env: newEnv}, tail: newStack.tail};
        }
        return UpdateContinue({...prog, stack: newStack}, updateData,
          function(newX: ProgDiffs, oldX: Prog): UpdateResult {
          throw "TODO: Implement me (let/const)"
            // TODO: Recover definitions and the program shape.
          });
      } else if(varDecls.kind === "var") {
        //var = just unroll as variable assignments
        for(let decl of reverseArray(varDecls.declarations)) {
          var rewrittenNode = new Node.AssignmentExpression(
            decl.wsBeforeEq, "=", decl.id,  decl.right === null ? decl.id : decl.right
          );
          rewrittenNode.wsBefore = decl.wsBefore;
          rewrittenNode.wsAfter = decl.wsAfter;
          newStack = { head: {tag: StackValueType.Node, env: env, node: rewrittenNode}, tail: newStack };
        }
        return UpdateContinue({...prog, stack: newStack}, updateData,
          function(newX: ProgDiffs, oldX: Prog): UpdateResult {
          throw "TODO: Implement me (var)"
            // TODO: Reconstruct program and diffs from rewriting
          }
        );
      } else return UpdateFail("Unknown variable declaration kind: " + varDecls.kind);
    case Syntax.ExpressionStatement:
      // We compute heap modifications. Only if stackHead marked with returnedExpressionStatement = true can we propagate updateData to the expression.
      // propagate environment to the next statement
      newStack = { head: {...newStack.head, env: env}, tail: newStack.tail};
      let expStatement = oldNode as Node.ExpressionStatement;
      if(stackHead.returnedExpressionStatement) {
        // Add the expression to the stack.
        newStack = { head:  {tag: StackValueType.Node, env: env, node: expStatement.expression}, tail: newStack };
        return UpdateContinue({ ...prog, stack: newStack}, updateData,
          function(newX: ProgDiffs, oldX: Prog): UpdateResult {
            let updatedNode = new Node.ExpressionStatement(newX.stack.head.node, (oldNode as Node.ExpressionStatement).semicolon);
            updatedNode.wsBefore = (oldNode as Node.ExpressionStatement).wsBefore;
            updatedNode.wsAfter = (oldNode as Node.ExpressionStatement).wsAfter;
            let updatedStack = {
              head: {...newX.stack.head, node: updatedNode}, tail: newX.stack.tail}
            let updateDiffs = DDWrap(["stack", "head", "node"], newX.diffs, d => DDChild("expression", d));
            return UpdateResult(
            {...prog,
             stack: updatedStack,
             diffs: updateDiffs,
            }
            , prog);
          }
        )
      } else {
        // No back-propagation at this point. We just move on but the heap is now a reference in case we need it.
        return UpdateContinue(
          {...prog,
          heapSource: {tag: HeapSourceType.After, source:
            {env: env,
             expr: expStatement.expression,
             heapSource: prog.heapSource}
          },
        stack: newStack}, updateData,
        function(newX: ProgDiffs, oldX: Prog): UpdateResult {
          // TODO: Reconstruct Expression statement and diffs.
          throw "TODO: Implement me (ExpressionStatement)"
        });
      }
    case Syntax.Literal: // Literals can be replaced by clones
      // TODO: Make sure this is correct. Make the stack to work.
      return processClones(prog, updateData, (diff: DUpdate) => {
        let newDiffs = DDChild(["stack", "head", "node", "value"], DDNewValue(updateData.newVal)); // TODO: What about string diffs?
        let newNode = Object.create(oldNode);
        newNode.value = updateData.newVal;
        return UpdateResult({ ...prog,
          stack: { head: {...stackHead, node: newNode}, tail: newStack }, diffs: newDiffs}, prog);
      });
    case Syntax.Identifier: // Updates the environment, or the heap.
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
      throw "TODO: Implement me (Identifier)"
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
          if(diff.ctor === DType.Clone) {
            return processClone(prog, updateData.newVal, updateData.oldVal, diff);
          } else {
            let newNode = new Node.Literal(oldNode.wsBefore, updateData.newVal, uneval_(updateData.newVal)); // TODO: What about string diffs?
            return UpdateResult({ ...prog,
              stack: { head: { ...stackHead, node: newNode}, tail: newStack}, diffs: DDChild(["stack", "head", "node"], DDNewNode(newNode))}, prog);
          }
        }));
      }
      return processClones(prog, updateData, (diff: DUpdate) => {
        var elements: AnyNode[] = (oldNode as Node.ArrayExpression).elements;
        let newNode: Node.ArrayExpression;
        let newDiffs: DUpdate[];
        if(diff.kind.ctor === DUType.Reuse) {
          newNode = Object.create(oldNode);
          newDiffs = DDReuse({elements: DDSame()});
          return updateForeach(prog.stack.head.env, elements, 
            (element, k) => callback => 
              typeof diff.children[k] != "undefined" ?
                UpdateContinue({...prog, context: [oldNode].concat(prog.context), stack: {head: {...stackHead, node: element}, tail: newStack} },
                  {newVal: (updateData.newVal as any[])[k],
                   oldVal: (updateData.oldVal as any[])[k],
                   diffs: diff.children[k]}, callback) :
                UpdateResult(
                  {...prog, stack: { head: {...stackHead, node: element}, tail: newStack }, diffs: DDSame()}, prog, callback),
            arrayGather(prog, newNode, newDiffs));
        } else {
          return UpdateFail("Don't know how to handle this kind of diff on arrays: " + diff.kind.ctor);
        }
      });
    default:
      return UpdateFail("Reversion does not currently support nodes of type " + oldNode.type);
    }
  }
  return UpdateFail("Reversion does not support this current stack element: " + stackHead.tag);
}

// Find all paths from complexVal to simpleVal if complexVal contains simpleVal
function allClonePaths_(complexVal: any, simpleVal: any): Path[] {
  if(uneval_(simpleVal) === uneval_(complexVal)) return [{ up: 0, down: []}];
  if(typeof complexVal == "object") {
    let diffs = [];
    for(let k in complexVal) {
      diffs.push(...allClonePaths_(complexVal[k], simpleVal).map(p => {
        p.down.unshift(k);
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
  return d.ctor == DType.Clone && (d as DClone).path.up === 0 && (d as DClone).path.down.length == 1;
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
        childDiffs[key] = DDClone({up: 0, down: [key]}, DDSame());
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
                return Math.abs(parseInt(d1.path.down[0] + "") - nKey - lastClosestOffset) -
                       Math.abs(parseInt(d2.path.down[0] + "") - nKey - lastClosestOffset);
              });
              lastClosestOffset = parseInt((cd[0] as DClone).path.down[0] + "") - nKey;
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
        diffs.push({ctor: DType.Clone, path: clonePaths[c], diffs: DDSame()});
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
        diffs.push({ctor: DType.Clone, path: unwrappingPaths[c], diffs: DDSame()});
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
  var updated = processUpdateAction(updateAction, callbacks, forks);
  return resultCase(updated, function(x) { return Err(x); },
    function(progWithAlternatives: ProgWithAlternatives): Res<string, Update_Result> {
      var uResult = {
        env: progWithAlternatives.prog.stack.head.env,
        node: progWithAlternatives.prog.stack.head.node.unparse(),
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
