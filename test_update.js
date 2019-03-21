

//console.log(uneval_(computeDiffs_(12, [12, 13])));
//console.log(uneval_(computeDiffs_([12, '14'], 12)));
//console.log(uneval_(computeDiffs_(12, 12)));

let envX12 = {head: {name: "x", value: {
    v_: 12
  }},
  tail: undefined};

let tests = 0;
let testsPassed = 0;
  
function assertUpdate(env, code, value, newCode, envPredicate) {
  tests++;
  var result = update_(envX12, code)(value);
  if(result.ctor == "Ok") {
    if(result._0.node !== newCode) {
      console.log("Error: Expected " + newCode + ", got " + result._0.node);
    } else {
      result = envPredicate ? envPredicate(result._0.env) : undefined;
      if(result && result.ctor == "Err") {
        console.log("Error: " + result._0);
      } else {
        testsPassed++;
      }
    }
  } else {
    console.log("Error: " + result._0);
  }
}
function envEqual(name, v_) {
  return function(newEnv) {
    var result = List.foreach(newEnv, function(binding) {
      if(binding.name == name) {
        if(binding.value.v_ === v_) {
         console.log("ok");
          return Ok("");
        } else {
         console.log("err");
          return Err("Expected that " + name + " = " + v_ + ", got " + binding.value.v_);
        }
      }
    });
    return result || Err(name + " not found in env " + uneval_(newEnv))
  }
}
assertUpdate(envX12, "/*-*/1//x", 2, "/*-*/2//x");
assertUpdate(envX12, "/*-*/'1'//x", 2, "/*-*/2//x");
assertUpdate(envX12, "/*-*/1//x", '2', "/*-*/\"2\"//x");
assertUpdate(envX12, "/*-*/'1'//x", '2', "/*-*/'2'//x");
assertUpdate(envX12, "/*-*/\"1\"//x", '2', "/*-*/\"2\"//x");
assertUpdate(envX12, "/*-*/ x //y", '2', "/*-*/ x //y", envEqual("x", "2"));
assertUpdate(envX12, "/*-*/[15,/***/16]", [12, 13], "/*-*/[12,/***/13]");
assertUpdate(envX12, "/*-*/x", [12, 13], "[/*-*/x, 13]");
assertUpdate(envX12, '[x, " ", ["italic", {italic:true}]," ",["underlined",{underline:true}]]', [["Normal",{bold:true}]," ",["italic",{italic:true}]," ",["underlined",{underline:true}]],
  '[[x, {bold:true}], " ", ["italic", {italic:true}]," ",["underlined",{underline:true}]]')
console.log(testsPassed + "/" + tests + " passed");