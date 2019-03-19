import * as syntax from './syntax';
import * as Node from './nodes';
import * as esprima from './esprima';

type Ok<a> = { ctor: 'Ok', _0: a}
type Err<a> = { ctor: 'Err', _0: a}
type Res<err,ok> = Err<err> | Ok<ok> 
declare function Ok<a>(arg: a): Ok<a>;
declare function Err<a>(arg: a): Err<a>;
declare function resultCase<err,ok,a>(arg: Res<err,ok>, cb1: ((e: err) => a), cb2: ((o: ok) => a)): a;
type Env = undefined | { head: {name: string, value: EnvValue}, tail: Env}
type EnvValue = { v_: any, vName_: any, expr: any, env: Env}
declare function updateVar_(env: Env, name: string, cb: (oldv: EnvValue) => EnvValue): Env
type AnyNode = Node.ExportableDefaultDeclaration// & { update?: (prog: Prog, newVal: UpdateData) => UpdateAction }
type Prog = {
  context: AnyNode[],
  env: Env,
  node: AnyNode}  // Will add heap, stack and expression context later.
type ProgDiffs = Prog & { diffs: Diffs }
type UpdateData = {newVal: any, oldVal: any, diffs?: Diffs}
declare let Logger: { log: (content: any) => any };
declare function mergeUpdatedEnvs(env1: Env, env2: Env): Env;
declare function uneval_(x: any): string
declare function buildEnvJS_(env: Env): any
declare function evaluate_(env: Env, $$source$$$: string): any
declare function newCall(s: string, args: any[]): any

enum DType {
    Clone = "Clone",
    Update = "Update"
};
enum DUType {
  Reuse = "Reuse",
  NewValue = "New",
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

function DDReuse(childDiffs): DUpdate[] {
  return [{
    ctor: DType.Update,
    kind: {ctor: DUType.Reuse },
    children: childDiffs
  }];
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
  if(diff.path.up <= prog.context.length) {
    var toClone: AnyNode = diff.path.up == 0 ? prog.node : prog.context[diff.path.up - 1];
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
        node: Object.create(toClone),
        diffs: DDClone({up: diff.path.up, down: nodePathDown}, DDSame())}, prog, callback)
    } else {
      return UpdateContinue({...prog,
            node: Object.create(toClone)},
          {newVal: newVal, oldVal: oldVal, diffs: diff.diffs},
          callback || UpdateResult);
    }
  } else {
    return UpdateFail("Difference outside of context");
  }
}

function valToNodeDiffs_(value: any): DUpdate[] {
  return DDNewNode(value);
}

function valToNode_(value: any): AnyNode {
  var Node = esprima.Node;
  if(typeof value == "number" || typeof value == "boolean" || typeof value == "string" || typeof value == "object" && value === null) {
    return new Node.Literal("", value, uneval_(value));
  } else if(typeof value == "object") {
    if(Array.isArray(value)) {
      return new Node.ArrayExpression("", value.map(valToNode_), [], "");
    } else {
      var children: Node.Property[] = [];
      for(let k in value) {
        var v = value[k];
        var propertyKey = new Node.Identifier("", k, k);
        var propertyValue = valToNode_(v) as Node.PropertyValue;
        children.push(new Node.Property("init", propertyKey, "", "", "", "", false, propertyValue, false, false));
      }
      return new Node.ObjectExpression("", children, [], "");
    }
  }
  return new Node.Literal("", null, "null");
}

function processClones(prog: Prog, updateData: UpdateData,
     otherwise?: (diff: DUpdate) => UpdateAction ): UpdateAction {
  var Syntax = syntax.Syntax || esprima.Syntax;
  return UpdateAlternative(...updateData.diffs.map(function(diff: Diff): UpdateAction {
    if(diff.ctor === DType.Clone) {
      return processClone(prog, updateData.newVal, updateData.oldVal, diff);
    } else if(diff.kind.ctor === DUType.NewValue && Array.isArray(diff.kind.model)) {
      let oldFormat = prog.node.type === Syntax.ArrayExpression ? prog.node as Node.ArrayExpression : { wsBefore: "", separators: [], wsBeforeClosing: ""};
      let newNode = new Node.ArrayExpression(oldFormat.wsBefore, diff.kind.model.map(valToNode_), oldFormat.separators, oldFormat.wsBeforeClosing);
      let newDiffs = DDNewNode(newNode);
      return updateForeach(prog.env, updateData.newVal as any[],
        (newChildVal, k) => callback => {
          let childDiff = diff.children[k];
          if(childDiff.length == 1 && childDiff[0].ctor === DType.Update &&
             (childDiff[0] as DUpdate).kind.ctor !== DUType.Reuse
          ) { // New values are not back-propagated in this context. We don't want them to flow through or otherwise change the existing function.
            let newChildNode = valToNode_(newChildVal);
            let newChildNodeDiffs = valToNodeDiffs_(newChildVal);
            return UpdateResult({...prog, node: newChildNode, diffs: newChildNodeDiffs}, prog, callback);
          } else { // Clones and reuse go through this
            let oldChildVal = (updateData.oldVal as any[])[k];
            return UpdateContinue(prog, {
                 newVal: newChildVal, oldVal: oldChildVal, diffs: childDiff }, callback)
          }
        },
        arrayGather(prog, newNode, newDiffs)
      )
    } else { // TODO: Deal with string literals in a better way.
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
        var mergedEnv = mergeUpdatedEnvs(envSoFar, newProg.env);
        return aux(mergedEnv, nodesSoFar.concat(newProg.node), diffsSoFar.concat(newProg.diffs), i + 1);
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
    newDiffs[0].children.elements = DDReuse(newNodesDiffs);
    return UpdateResult({...prog, env: newEnv, node: newNode, diffs: newDiffs}, prog);
  }
}

// Update.js is generated by Update.ts
function getUpdateAction(prog: Prog, updateData: UpdateData): UpdateAction {
  /*if(prog.node.update) { // In case there is a custom update procedure available.
    return prog.node.update{prog, diff};
  }*/
  var Syntax = syntax.Syntax || esprima.Syntax;
  var Node = typeof Node == "undefined" ? esprima.Node : Node;
  var oldNode = prog.node;
  if(oldNode.type == Syntax.Program) {
    let script: Node.Script = oldNode as Node.Script;
    if(script.body.length != 1)
      return UpdateFail("Reversion currently supports only 1 directive in program, got " + script.body.length);
    var e = script.body[0];
    if(e.type != Syntax.ExpressionStatement)
      return UpdateFail("Reversion currently supports only expression statements, got " + e.type);
    var x = (e as Node.ExpressionStatement).expression;
    return UpdateContinue({ ...prog, node: x}, updateData,
      function(newX: ProgDiffs, oldX: Prog): UpdateResult {
        let newNode = Object.create(oldNode); // Deep copy
        newNode.body[0].expression = newX.node;
        let diffs = DDReuse({body:DDReuse({"0":DDReuse({expression:newX.diffs})})});
        return UpdateResult({...newX, node: newNode, diffs: diffs}, prog);
      }
    )
  }

  if(oldNode.type == Syntax.Literal) { // Literals can be replaced by clones
    return processClones(prog, updateData, (diff: DUpdate) => {
      let newDiffs = DDReuse({value: DDNewValue(updateData.newVal)}); // TODO: What about string diffs?
      let newNode = Object.create(oldNode);
      newNode.value = updateData.newVal;
      return UpdateResult({ ...prog,
        node: newNode, diffs: newDiffs}, prog);
    });
  }

  if(oldNode.type == Syntax.Identifier) {
    // TODO: Environment diffs
    // TODO: Immediately update expression. Will merge expressions later.
    var newEnv = updateVar_(prog.env, (oldNode as Node.Identifier).name, function(oldValue: EnvValue): EnvValue {
      return {v_: updateData.newVal,
              vName_: typeof oldValue.vName_ != "undefined" ? updateData.newVal : undefined,
              expr: oldValue.expr, // TODO: Update this expression as well !
              env: oldValue.env};
    });
    // Process clone expressions first.
    return UpdateAlternative(
      processClones(prog, updateData),
      UpdateResult({...prog, env: newEnv, diffs: DDSame()}, prog));
  }

  if(oldNode.type == Syntax.ArrayExpression) {
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
          let newNode = new Node.Literal(oldNode.wsBefore, updateData.newVal, updateData.newVal); // TODO: What about string diffs?
          return UpdateResult({ ...prog,
            node: newNode, diffs: DDNewNode(newNode)}, prog);
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
        return updateForeach(prog.env, elements, 
          (element, k) => callback => 
            typeof diff.children[k] != "undefined" ?
              UpdateContinue({...prog, context: [oldNode].concat(prog.context), node: element},
                {newVal: (updateData.newVal as any[])[k],
                 oldVal: (updateData.oldVal as any[])[k],
                 diffs: diff.children[k]}, callback) :
              UpdateResult({...prog, node: element, diffs: DDSame()}, prog, callback),
          arrayGather(prog, newNode, newDiffs));
      } else {
        return UpdateFail("Don't know how to handle this kind of diff on arrays: " + DUType[diff.kind.ctor]);
      }
    });
  }
  return UpdateFail("Reversion does not currently support nodes of type " + oldNode.type);
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
    typeof value[1] == "object";
}

function isElement_(value: any) {
  return typeof value == "object" &&
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] == "string" &&
    typeof value[1] == "object" &&
    typeof value[2] == "object" &&
    Array.isArray(value[2]);
}

// Later, we could include the context while computing diffs to recover up clones.
function computeDiffs_(oldVal: any, newVal: any): Diffs {
  let o: string = typeof oldVal;
  let n: string = typeof newVal;
  if(o == "function" || n == "function") {
    return []; // Cannot diff functions
  }
  if(o == "number" || o == "boolean" || o == "string") {
    if(n == "boolean" || n == "number" ||
     n == "string") {
      if(oldVal === newVal)
        return DDSame();
      // if(n == "string") // TODO: String diffs
      return DDNewValue(newVal);
    } else if(n == "object" ) { // maybe the number was included in the object/array
      var childDiffs: ChildDiffs = {};
      for(var key in newVal) {
        var newValChild = newVal[key];
        childDiffs[key] = computeDiffs_(oldVal, newValChild);
      }
      if(Array.isArray(newVal)) {
        return DDNewArray(newVal.length, childDiffs)
      } else {
        return DDNewObject(childDiffs);
      }
    }
  } else if(o == "object") {
    if(n == "number" || n == "string" || n == "boolean") {
      // It could have been cloned from one of the object's descendent.
      var clonePaths = allClonePaths_(oldVal, newVal);
      var diffs: Diffs = [];
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
      let diffs: Diffs = [];
      let sameKeys = uneval_(Object.keys(newVal)) == uneval_(Object.keys(oldVal));
      if(sameKeys) { // Check if they are compatible for reuse
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
      let unwrappingPaths = allClonePaths_(o, n);
      for(let c in unwrappingPaths) {
        diffs.push({ctor: DType.Clone, path: unwrappingPaths[c], diffs: DDSame()});
      }
      // Now let's create a new object or array and obtain the children from the original.
      // Values might be wrapped that way.
      let childDiffs: ChildDiffs = {};
      for(var key in newVal) {
        childDiffs[key] = computeDiffs_(oldVal, newVal[key]);
      }
      if(Array.isArray(newVal)) {
        diffs.push(...DDNewObject(childDiffs));
      } else {
        diffs.push(...DDNewArray(newVal.length, childDiffs));
      }
      return diffs;
    }
  }
  // Symbols
  return [];
}

type Update_Result = {env: Env, node: String};

// Given the old formula and the new value, try to generate a new formula.
// If fails, return false
// update_: (Env, StringFormula) -> StringValue -> (Ok([Env (updated with flags), StringFormula]) | Err(msg))
function update_(env, oldFormula): (newVal: any) => Res<string, Update_Result> {
  /*addUpdateMethods();*/
  var oldNode = esprima.parseScript(oldFormula);
  var oldVal = evaluate_(env, oldFormula);
  
  return function(newVal: any):Res<string, Update_Result> {
    var diffs = computeDiffs_(oldVal, newVal);
    var updated = processUpdateAction(UpdateContinue({context: [], env: env, node: oldNode}, {newVal: newVal, oldVal: oldVal, diffs: diffs}));
    return resultCase(updated, function(x) { return Err(x); },
      function(progWithAlternatives: ProgWithAlternatives): Res<string, Update_Result> {
        return Ok<Update_Result>({env: progWithAlternatives.prog.env, node: progWithAlternatives.prog.node.unparse()});
      }
    )
  }
}

function testUpdate() {
  Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
