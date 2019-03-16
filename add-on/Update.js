"use strict";
// Test
function updateDirect(env, oldNode, newValue) {
    if (oldNode.type == Syntax.Program) {
        if (oldNode.body.length != 1) {
            return Err("Reversion currently supports only 1 directive in program, got " + oldNode.body.length);
        }
        var e = oldNode.body[0];
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
        var subExpressions = oldNode.
            return;
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
        return resultCase(updated, function (x) { return Err(x); }, function (envNode) {
            return Ok([envNode[0], envNode[1].unparse()]);
        });
    };
    return jsFormulaCase(oldFormula, {
        whitespaces: function (wsBefore, content, wsAfter) {
            return function (newOutput) {
                return resultCase(update_(env, content)(newOutput), Err, function (envX) {
                    return Ok([envX[0], wsBefore + envX[1] + wsAfter]);
                });
            };
        },
        string: function (string) {
            var charDelim = string[0];
            return function (newOutput) {
                return Ok([env, toExpString(newOutput, charDelim)]);
            };
        },
        number: function (numberValue, numberString) {
            return function (newOutput) {
                return Ok([env, numberValue == newOutput ? numberString : "" + newOutput]);
            };
        },
        boolean: function (boolValue) {
            return function (newOutput) {
                return Ok([env, "" + newOutput]);
            };
        },
        parentheses: function (content) {
            return function (newOutput) {
                return resultCase(update_(env, content)(newOutput), Err, function (envX) {
                    return Ok([envX[0], "(" + envX[1] + ")"]);
                });
            };
        },
        variable: function (name) {
            return function (newOutput) {
                var newEnv = updateVar_(env, name, function (oldValue) {
                    return { v_: newOutput,
                        vName_: typeof oldValue.vName_ != "undefined" ? newOutput : undefined,
                        expr: oldValue.expr,
                        env: oldValue.env };
                });
                return Ok([newEnv, name]);
            };
        },
        operator: function (left, ws, op, right) {
            return function (newOutput) {
                return Err("Cannot back-propagate changes through operator " + op + " yet");
            };
        },
        orElse: function (formula) {
            return function (newOutput) {
                return Err("could not update " + formula + " with " + newOutput + ", no rule found");
            };
        }
    });
}
function testUpdate() {
    Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
