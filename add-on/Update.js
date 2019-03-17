function updateDirect(env, oldNode, newValue) {
    if (oldNode.type == Syntax.Program) {
        var script = oldNode;
        if (script.body.length != 1) {
            return Err("Reversion currently supports only 1 directive in program, got " + script.body.length);
        }
        var e = script.body[0];
        if (e.type != Syntax.ExpressionStatement) {
            return Err("Reversion currently supports only expression statements, got " + e.type);
        }
        var x = e.expression;
        return resultCase(updateDirect(env, x, newValue), function (err) { return Err(err); }, function (envX) {
            var newNode = Object.create(oldNode);
            newNode.body[0].expression = envX[1];
            return Ok([envX[0], newNode]);
        });
    }
    if (oldNode.type == Syntax.Literal) {
        var newNode = Object.create(oldNode);
        newNode.value = newValue;
        return Ok([env, newNode]);
    }
    if (oldNode.type == Syntax.Identifier) {
        var newEnv = updateVar_(env, oldNode.name, function (oldValue) {
            return { v_: newValue,
                vName_: typeof oldValue.vName_ != "undefined" ? newValue : undefined,
                expr: oldValue.expr,
                env: oldValue.env };
        });
        return Ok([newEnv, oldNode]);
    }
    if (oldNode.type == Syntax.ArrayExpression) {
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
function update_(env, oldFormula) {
    var oldNode = esprima.parseScript(oldFormula);
    return function (newOutput) {
        var updated = updateDirect(env, oldNode, newOutput);
        return resultCase(updated, function (x) { return Err(x); }, function (prog) {
            return Ok([prog[0], prog[1].unparse()]);
        });
    };
}
function testUpdate() {
    Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
