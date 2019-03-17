import * as syntax from './syntax';
import * as Node from './nodes';
import * as esprima from './esprima';
var Syntax = syntax.Syntax;

type Ok<a> = { ctor: 'Ok', _0: a}
type Err<a> = { ctor: 'Err', _0: a}
type Res<err,ok> = Err<err> | Ok<ok> 
declare function Ok<a>(arg: a): Ok<a>;
declare function Err<a>(arg: a): Err<a>;
declare function resultCase<err,ok,a>(arg: Res<err,ok>, cb1: ((e: err) => a), cb2: ((o: ok) => a)): a;
type Env = undefined | { head: {name: string, value: EnvValue}, tail: Env}
type EnvValue = { v_: any, vName_: any, expr: any, env: Env}
declare function updateVar_(env: Env, name: string, cb: (oldv: EnvValue) => EnvValue): Env
type AnyNode = Node.ExportableDefaultDeclaration
type Prog = [Env, AnyNode]
type UpdateResult = Res<string,Prog>
declare let Logger: { log: (content: any) => any };

function updateDirect(env: Env, oldNode: AnyNode, newValue: any): Res<string,Prog> {
  if(oldNode.type == Syntax.Program) {
    let script: Node.Script = oldNode as Node.Script;
    if(script.body.length != 1) {
      return Err("Reversion currently supports only 1 directive in program, got " + script.body.length)
    }
    var e = script.body[0];
    if(e.type != Syntax.ExpressionStatement) {
      return Err("Reversion currently supports only expression statements, got " + e.type);
    }
    var x = (e as Node.ExpressionStatement).expression;
    return resultCase(
      updateDirect(env, x, newValue), function(err: string):UpdateResult { return Err(err) },
      function(envX: Prog):UpdateResult {
        let newNode = Object.create(oldNode);
        newNode.body[0].expression = envX[1];
        return Ok<Prog>([envX[0], newNode as AnyNode])
      }
    )
  }
  if(oldNode.type == Syntax.Literal) {
    var newNode = Object.create(oldNode);
    newNode.value = newValue;
    return Ok<Prog>([env, newNode]);
  }

  if(oldNode.type == Syntax.Identifier) {
    var newEnv = updateVar_(env, (oldNode as Node.Identifier).name, function(oldValue: EnvValue): EnvValue {
      return {v_: newValue,
              vName_: typeof oldValue.vName_ != "undefined" ? newValue : undefined,
              expr: oldValue.expr, // Will be updated later.
              env: oldValue.env};
    });
    return Ok<Prog>([newEnv, oldNode]);
  }
  if(oldNode.type == Syntax.ArrayExpression) {
    // For arrays of size 2 where
    // - the second node is an object
    // - and the first one is a string
    // it is possible to push back a string (the object is copied)
    // 
    //var subExpressions = oldNode.
    //return ;
  }
  return Err("Reversion does not currently support nodes of type " + oldNode.type);
}

// Given the old formula and the new value, try to generate a new formula.
// If fails, return false
// update_: (Env, StringFormula) -> StringValue -> (Ok([Env (updated with flags), StringFormula]) | Err(msg))
function update_(env, oldFormula): (newOutput: any) => Res<string, Prog> {
  var oldNode = esprima.parseScript(oldFormula);
  return function(newOutput: any):Res<string, Prog> {
    var updated: Res<string, Prog> = updateDirect(env, oldNode, newOutput);
    return resultCase(updated, function(x) { return Err(x); },
      function(prog: Prog): Res<string, Prog> {
        return Ok<Prog>([prog[0], prog[1].unparse()]);
      }
    )
  }
}

function testUpdate() {
  Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
