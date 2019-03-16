
var any = '[\\s\\S]';
var commentStart = '\\/\\*';
var commentEnd = '\\*\\/';
var stringStart = '"';
var string2Start = "'";
var stringEnd = '"';
var string2End = "'";
var bs = "\\\\";
var allXept = function(regex, escapes) { return escapes ? "(?:(?:(?!"+regex+")"+any+")|"+escapes+")*?" :
                 "(?:(?!"+regex+")"+any+")*?" };
var allXeptCommentStringStart = allXept(""+commentStart+"|"+stringStart+"|"+string2Start+"");
var allXeptCommentEnd = allXept(commentEnd);
var allXeptStringEnd  = allXept(stringEnd+"|"+bs, ''+bs+'"|'+bs+bs+"|"+bs+"[0-9a-fA-F]+|"+bs+any);
var allXeptString2End = allXept(string2End+"|"+bs,''+bs+"'|"+bs+bs+"|"+bs+"[0-9a-fA-F]+|"+bs+any);
var stringRegex = stringStart+allXeptStringEnd+stringEnd + "|" + string2Start+allXeptString2End+string2End;
var content = allXeptCommentStringStart+
     "(?:(?:"+commentStart+allXeptCommentEnd+commentEnd +
     "|" + stringRegex + ")"+
     allXeptCommentStringStart +")*?"

var allXeptComment = allXept(commentStart);
var wsXept = function (regex, escapes) { return escapes ? "(?:(?:(?!"+regex+")\\s)|"+escapes+")*" : // Greedy
"(?:(?!"+regex+")\\s)*"; };
var ws = wsXept(commentStart) + "(?:"+commentStart+allXeptCommentEnd+commentEnd+wsXept(commentStart)+")*"

var varName = "[a-zA-Z_\\$][a-zA-Z_\\$0-9]*";

var numberRegex = 
    '[-+]?' +                       // Optional sign.
    '(?:[0-9]{0,30}\\.)?' +         // Optionally 0-30 decimal digits of mantissa.
    '[0-9]{1,30}' +                 // 1-30 decimal digits of integer or fraction.
    '(?:[Ee][-+]?[1-2]?[0-9])?'     // Optional exponent 0-29 for scientific notation.