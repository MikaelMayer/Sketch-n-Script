
// Given the old formula and the new value, try to generate a new formula.
// If fails, return false
// update_: (Env, StringFormula) -> StringValue -> (Ok([Env (updated with flags), StringFormula]) | Err(msg))
function update_(env, oldFormula) {
  return jsFormulaCase(oldFormula, {
    whitespaces: function(wsBefore, content, wsAfter) {
      return function(newOutput) {
        return resultCase(
          update_(env, content)(newOutput), Err,
          function(envX) {
            return Ok([envX[0], wsBefore + envX[1] + wsAfter])
          });
      }},
    string: function(string) {
        var charDelim = string[0];
        return function(newOutput) {
          return Ok([env, toExpString(newOutput, charDelim)]);
        } 
      },
    number: function(numberValue, numberString) {
        return function(newOutput) {
          return Ok([env, numberValue == newOutput ? numberString : "" + newOutput]);
        }
      },
    boolean: function(boolValue) {
        return function(newOutput) {
          return Ok([env, "" + newOutput]);
        }
      },
    parentheses: function(content) {
        return function(newOutput) {
          return resultCase(
            update_(env, content)(newOutput), Err,
            function(envX) {
              return Ok([envX[0], "(" + envX[1] + ")"]);
            });
        };
      },
    variable: function(name) {
        return function(newOutput) {
          var newEnv = updateVar_(env, name, function(oldValue) {
            return {v_: newOutput,
                    vName_: typeof oldValue.vName_ != "undefined" ? newOutput : undefined,
                    expr: oldValue.expr,
                    env: oldValue.env};
          });
          return Ok([newEnv, name]);
        };
      },
    operator: function(left, ws, op, right) {
        return function(newOutput) {
          return Err("Cannot back-propagate changes through operator " + op + " yet");
        }
      },
    orElse: function(formula) {
        return function(newOutput) {
          return Err("could not update " + formula + " with " + newOutput + ", no rule found");
        }
      }
  });
}

function testUpdate() {
  Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
