export declare type ArgumentListElement = Expression | SpreadElement;
export declare type ArrayExpressionElement = Expression | SpreadElement | null;
export declare type ArrayPatternElement = AssignmentPattern | BindingIdentifier | BindingPattern | RestElement | null;
export declare type BindingPattern = ArrayPattern | ObjectPattern;
export declare type BindingIdentifier = Identifier;
export declare type Declaration = AsyncFunctionDeclaration | ClassDeclaration | ExportDeclaration | FunctionDeclaration | ImportDeclaration | VariableDeclaration;
export declare type ExportableDefaultDeclaration = BindingIdentifier | BindingPattern | ClassDeclaration | Expression | FunctionDeclaration;
export declare type ExportableNamedDeclaration = AsyncFunctionDeclaration | ClassDeclaration | FunctionDeclaration | VariableDeclaration;
export declare type ExportDeclaration = ExportAllDeclaration | ExportDefaultDeclaration | ExportNamedDeclaration;
export declare type Expression = ArrayExpression | ArrowFunctionExpression | AssignmentExpression | AsyncArrowFunctionExpression | AsyncFunctionExpression | AwaitExpression | BinaryExpression | CallExpression | ClassExpression | ComputedMemberExpression | ConditionalExpression | Identifier | FunctionExpression | Literal | NewExpression | ObjectExpression | RegexLiteral | SequenceExpression | StaticMemberExpression | TemplateLiteral | TaggedTemplateExpression | Import | ThisExpression | UnaryExpression | UpdateExpression | YieldExpression;
export declare type FunctionParameter = AssignmentPattern | BindingIdentifier | BindingPattern;
export declare type ImportDeclarationSpecifier = ImportDefaultSpecifier | ImportNamespaceSpecifier | ImportSpecifier;
export declare type ObjectExpressionProperty = Property | SpreadElement;
export declare type ObjectPatternProperty = Property | RestElement;
export declare type Statement = AsyncFunctionDeclaration | BreakStatement | ContinueStatement | DebuggerStatement | DoWhileStatement | EmptyStatement | ExpressionStatement | Directive | ForStatement | ForInStatement | ForOfStatement | FunctionDeclaration | IfStatement | ReturnStatement | SwitchStatement | ThrowStatement | TryStatement | VariableDeclaration | WhileStatement | WithStatement | BlockStatement | LabeledStatement;
export declare type PropertyKey = Identifier | Literal | Expression;
export declare type PropertyValue = AssignmentPattern | AsyncFunctionExpression | BindingIdentifier | BindingPattern | FunctionExpression;
export declare type StatementListItem = Declaration | Statement;
export declare type UnparseElement = {
    name?: string;
    map?: any;
} | string;
export declare type UnparseArray = UnparseElement[];
export interface Unparsable {
    wsBefore: string;
    unparse(unparsable?: Unparsable): string;
    wsAfter: string;
}
export declare type UnparsableOrNull = Unparsable | null;
export declare let unparseChildren: (parent?: any, join?: string | string[], defaultJoin?: string) => (children: UnparsableOrNull[]) => string;
export declare let unparseChild: (parent?: any) => (node: UnparsableOrNull) => string;
export declare class ArrayExpression {
    readonly type: string;
    readonly elements: ArrayExpressionElement[];
    readonly wsBefore: string;
    readonly wsBeforeClosing: string;
    readonly separators: string[];
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, elements: ArrayExpressionElement[], separators: string[], wsBeforeClosing: string);
}
export declare class ArrayPattern {
    readonly type: string;
    readonly elements: ArrayPatternElement[];
    readonly wsBefore: string;
    readonly wsBeforeClosing: string;
    readonly separators: string[];
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, elements: ArrayPatternElement[], separators: string[], wsBeforeClosing: string);
}
export declare class ArrowFunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement | Expression;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    readonly noparens: boolean;
    wsBefore: string;
    readonly wsBeforeAsync: string;
    readonly wsBeforeOpening: string;
    readonly separators: string[];
    readonly wsBeforeClosing: string;
    readonly wsBeforeArrow: string;
    readonly arrow: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeOpening: string, params: FunctionParameter[], separators: string[], wsBeforeClosing: string, noparens: boolean, wsBeforeArrow: string, body: BlockStatement | Expression, expression: boolean);
}
export declare class AssignmentExpression {
    readonly type: string;
    readonly operator: string;
    readonly left: Expression;
    readonly right: Expression;
    wsBefore: string;
    readonly wsBeforeOp: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeOp: string, operator: string, left: Expression, right: Expression);
}
export declare class AssignmentPattern {
    readonly type: string;
    readonly left: BindingIdentifier | BindingPattern;
    readonly right: Expression;
    wsBefore: string;
    readonly wsBeforeOp: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(left: BindingIdentifier | BindingPattern, wsBeforeOp: string, right: Expression);
}
export declare class AsyncArrowFunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement | Expression;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    readonly noparens: boolean;
    wsBefore: string;
    readonly wsBeforeAsync: string;
    readonly wsBeforeOpening: string;
    readonly separators: string[];
    readonly wsBeforeClosing: string;
    readonly wsBeforeArrow: string;
    readonly arrow: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeAsync: string, wsBeforeOpening: string, params: FunctionParameter[], separators: string[], wsBeforeClosing: string, noparens: boolean, wsBeforeArrow: string, body: BlockStatement | Expression, expression: boolean);
}
export declare type AnyFunctionExpression = AsyncFunctionDeclaration | FunctionDeclaration | AsyncFunctionExpression | FunctionExpression;
export declare class AsyncFunctionDeclaration {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    wsBefore: string;
    readonly wsBeforeAsync: string;
    readonly wsBeforeFunction: string;
    readonly wsBeforeStar: string;
    readonly wsBeforeParams: string;
    readonly separators: string[];
    readonly wsBeforeEndParams: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeAsync: string, wsBeforeFunction: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement);
}
export declare class AsyncFunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    wsBefore: string;
    readonly wsBeforeAsync: string;
    readonly wsBeforeFunction: string;
    readonly wsBeforeStar: string;
    readonly wsBeforeParams: string;
    readonly separators: string[];
    readonly wsBeforeEndParams: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeAsync: string, wsBeforeFunction: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement);
}
export declare class AwaitExpression {
    readonly type: string;
    readonly argument: Expression;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, argument: Expression);
}
export declare class BinaryExpression {
    readonly type: string;
    readonly operator: string;
    readonly left: Expression;
    readonly right: Expression;
    wsBefore: string;
    readonly wsBeforeOp: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(operator: string, left: Expression, right: Expression, wsBeforeOp: string);
}
export declare class BlockStatement {
    readonly type: string;
    readonly body: StatementListItem[];
    wsBefore: string;
    readonly wsBeforeEnd: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, body: StatementListItem[], wsBeforeEnd: string);
}
export declare class BreakStatement {
    readonly type: string;
    readonly label: Identifier | null;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, label: Identifier | null, semicolon: string);
}
export declare class CallExpression {
    readonly type: string;
    readonly callee: Expression | Import;
    readonly arguments: ArgumentListElement[];
    wsBefore: string;
    readonly wsBeforeArgs: string;
    readonly separators: string[];
    readonly wsBeforeEndArgs: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(callee: Expression | Import, wsBeforeArgs: string, args: ArgumentListElement[], separators: string[], wsBeforeEndArgs: string);
}
export declare class CatchClause {
    readonly type: string;
    readonly param: BindingIdentifier | BindingPattern;
    readonly body: BlockStatement;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeOpening: string, param: BindingIdentifier | BindingPattern, wsBeforeClosing: string, body: BlockStatement);
}
export declare class ClassBody {
    readonly type: string;
    readonly body: Property[];
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsAfterOpening: string;
    readonly wsBeforeClosing: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeOpening: string, wsAfterOpening: string, body: Property[], wsBeforeClosing: string);
}
export declare class ClassDeclaration {
    readonly type: string;
    readonly id: Identifier | null;
    readonly superClass: Identifier | null;
    readonly body: ClassBody;
    wsBefore: string;
    readonly wsBeforeExtends: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, id: Identifier | null, wsBeforeExtends: string, superClass: Identifier | null, body: ClassBody);
}
export declare class ClassExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly superClass: Identifier | null;
    readonly body: ClassBody;
    wsBefore: string;
    readonly wsBeforeExtends: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, id: Identifier | null, wsBeforeExtends: string, superClass: Identifier | null, body: ClassBody);
}
export declare class ComputedMemberExpression {
    readonly type: string;
    readonly computed: boolean;
    readonly object: Expression;
    readonly property: Expression;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    wsAfter: string;
    unparse(): any;
    constructor(object: Expression, wsBeforeOpening: string, property: Expression, wsBeforeClosing: string);
}
export declare class ConditionalExpression {
    readonly type: string;
    readonly test: Expression;
    readonly consequent: Expression;
    readonly alternate: Expression;
    wsBefore: string;
    readonly wsBeforeQues: string;
    readonly wsBeforeColon: string;
    wsAfter: string;
    unparse(): any;
    constructor(test: Expression, wsBeforeQues: string, consequent: Expression, wsBeforeColon: string, alternate: Expression);
}
export declare class ContinueStatement {
    readonly type: string;
    readonly label: Identifier | null;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, label: Identifier | null, semicolon: string);
}
export declare class DebuggerStatement {
    readonly type: string;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, semicolon: string);
}
export declare class Directive {
    readonly type: string;
    readonly expression: Expression;
    readonly directive: string;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(expression: Expression, directive: string, semicolon: string);
}
export declare class DoWhileStatement {
    readonly type: string;
    readonly body: Statement;
    readonly test: Expression;
    wsBefore: string;
    readonly wsBeforeWhile: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(): any;
    constructor(wsBefore: string, body: Statement, wsBeforeWhile: string, wsBeforeOpening: string, test: Expression, wsBeforeClosing: string, semicolon: string, closingParens?: string);
}
export declare class EmptyStatement {
    readonly type: string;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, semicolon?: string);
}
export declare class ExportAllDeclaration {
    readonly type: string;
    readonly source: Literal;
    wsBefore: string;
    readonly wsBeforeStar: string;
    readonly wsBeforeFrom: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeStar: string, wsBeforeFrom: string, source: Literal, semicolon?: string);
}
export declare class ExportDefaultDeclaration {
    readonly type: string;
    readonly declaration: ExportableDefaultDeclaration;
    readonly wsBefore: string;
    readonly wsBeforeDefault: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeDefault: string, declaration: ExportableDefaultDeclaration, semicolon?: string);
}
export declare class ExportNamedDeclaration {
    readonly type: string;
    readonly declaration: ExportableNamedDeclaration | null;
    readonly specifiers: ExportSpecifier[];
    readonly source: Literal | null;
    wsBefore: string;
    readonly hasBrackets: boolean;
    readonly wsBeforeOpening: string;
    readonly separators: string[];
    readonly wsBeforeClosing: string;
    readonly wsBeforeFrom: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, declaration: ExportableNamedDeclaration | null, hasBrackets: boolean, wsBeforeOpening: string, specifiers: ExportSpecifier[], separators: string[], wsBeforeClosing: string, wsBeforeFrom: string, source: Literal | null, semicolon?: string);
}
export declare class ExportSpecifier {
    readonly type: string;
    readonly exported: Identifier;
    readonly local: Identifier;
    readonly noAs: boolean;
    wsBefore: string;
    readonly wsBeforeAs: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(local: Identifier, noAs: boolean, wsBeforeAs: string, exported: Identifier);
}
export declare class ExpressionStatement {
    readonly type: string;
    readonly expression: Expression;
    readonly semicolon: string;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(expression: Expression, semicolon: string);
}
export declare class ForInStatement {
    readonly type: string;
    readonly left: Expression;
    readonly right: Expression;
    readonly body: Statement;
    readonly each: boolean;
    wsBefore: string;
    readonly wsBeforeFor: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeKeyword: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeFor: string, wsBeforeOpening: string, left: Expression, wsBeforeKeyword: string, right: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class ForOfStatement {
    readonly type: string;
    readonly left: Expression;
    readonly right: Expression;
    readonly body: Statement;
    wsBefore: string;
    readonly wsBeforeFor: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeKeyword: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeFor: string, wsBeforeOpening: string, left: Expression, wsBeforeKeyword: string, right: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class ForStatement {
    readonly type: string;
    readonly init: Expression | null;
    readonly test: Expression | null;
    readonly update: Expression | null;
    body: Statement;
    wsBefore: string;
    readonly wsBeforeFor: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeSemicolon1: string;
    readonly wsBeforeSemicolon2: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeFor: string, wsBeforeOpening: string, init: Expression | null, wsBeforeSemicolon1: string, test: Expression | null, wsBeforeSemicolon2: string, update: Expression | null, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class FunctionDeclaration {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    wsBefore: string;
    readonly wsBeforeAsync: string;
    readonly wsBeforeFunction: string;
    readonly wsBeforeStar: string;
    readonly wsBeforeParams: string;
    readonly separators: string[];
    readonly wsBeforeEndParams: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeFunction: string, wsBeforeStar: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement, generator: boolean);
}
export declare class FunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    wsBefore: string;
    readonly wsBeforeAsync: string;
    readonly wsBeforeFunction: string;
    readonly wsBeforeStar: string;
    readonly wsBeforeParams: string;
    readonly separators: string[];
    readonly wsBeforeEndParams: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeFunction: string, wsBeforeStar: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement, generator: boolean);
}
export declare class Identifier {
    readonly type: string;
    readonly name: string;
    readonly original: string;
    readonly nameRaw: string;
    wsBefore: string;
    readonly wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, name: string, nameRaw: string);
}
export declare class IfStatement {
    readonly type: string;
    readonly ifKeyword: string;
    readonly test: Expression;
    readonly consequent: Statement;
    readonly alternate: Statement | null;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    readonly wsBeforeElse: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, ifKeyword: string, wsBeforeOpening: string, test: Expression, wsBeforeClosing: string, consequent: Statement, wsBeforeElse: string, alternate: Statement | null, closingParens?: string);
}
export declare class Import {
    readonly type: string;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: any);
}
export declare class ImportDeclaration {
    readonly type: string;
    readonly specifiers: ImportDeclarationSpecifier[];
    readonly source: Literal;
    wsBefore: string;
    readonly hasBrackets: boolean;
    readonly separators: string[];
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly wsBeforeFrom: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeOpening: string, hasBrackets: boolean, specifiers: ImportDeclarationSpecifier[], separators: string[], wsBeforeClosing: string, wsBeforeFrom: string, source: any, semicolon?: string);
}
export declare class ImportDefaultSpecifier {
    readonly type: string;
    readonly local: Identifier;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(local: Identifier);
}
export declare class ImportNamespaceSpecifier {
    readonly type: string;
    readonly local: Identifier;
    wsBefore: string;
    readonly wsBeforeAs: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeAs: string, local: Identifier);
}
export declare class ImportSpecifier {
    readonly type: string;
    readonly local: Identifier;
    readonly imported: Identifier;
    readonly asPresent: boolean;
    wsBefore: string;
    readonly wsBeforeAs: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(local: Identifier, asPresent: boolean, wsBeforeAs: string, imported: Identifier);
}
export declare class LabeledStatement {
    readonly type: string;
    readonly label: Identifier;
    readonly body: Statement | ClassDeclaration;
    wsBefore: string;
    readonly wsBeforeColon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(label: Identifier, wsBeforeColon: string, body: Statement | ClassDeclaration);
}
export declare function uneval(x: any): string;
export declare class Literal {
    readonly type: string;
    readonly value: boolean | number | string | null;
    readonly raw: string;
    readonly original: boolean | number | string | null;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, value: boolean | number | string | null, raw: string);
}
export declare class MetaProperty {
    readonly type: string;
    readonly meta: Identifier;
    readonly property: Identifier;
    wsBefore: string;
    readonly wsBeforeDot: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(meta: Identifier, wsBeforeDot: string, property: Identifier);
}
export declare class MethodDefinition {
    readonly type: string;
    readonly key: Expression;
    readonly computed: boolean;
    readonly value: AsyncFunctionExpression | FunctionExpression | null;
    readonly kind: 'init' | 'method' | 'constructor' | 'set' | 'get';
    readonly static: boolean;
    wsBefore: string;
    readonly wsBeforeGetSet: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly wsBeforeStatic: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeStatic: string, wsBeforeGetSet: any, key: Expression, computed: boolean, wsBeforeOpening: string, wsBeforeClosing: string, value: AsyncFunctionExpression | FunctionExpression | null, kind: 'init' | 'method' | 'constructor' | 'set' | 'get', isStatic: boolean);
}
export declare class Module {
    readonly type: string;
    readonly body: StatementListItem[];
    readonly sourceType: string;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(body: StatementListItem[], wsAfter: string);
}
export declare class NewExpression {
    readonly type: string;
    readonly callee: Expression;
    readonly arguments: ArgumentListElement[];
    wsBefore: string;
    readonly wsBeforeNew: string;
    readonly parentheses: boolean;
    readonly wsBeforeOpening: string;
    readonly separators: string[];
    readonly wsBeforeClosing: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBeforeNew: string, callee: Expression, parentheses: boolean, wsBeforeOpening: string, args: ArgumentListElement[], separators: string[], wsBeforeClosing: string);
}
export declare class ObjectExpression {
    readonly type: string;
    readonly properties: ObjectExpressionProperty[];
    wsBefore: string;
    readonly wsBeforeClosing: string;
    readonly separators: string[];
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, properties: ObjectExpressionProperty[], separators: string[], wsBeforeClosing: string);
}
export declare class ObjectPattern {
    readonly type: string;
    readonly properties: ObjectPatternProperty[];
    wsBefore: string;
    readonly separators: string[];
    readonly wsBeforeClosing: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, properties: ObjectPatternProperty[], separators: string[], wsBeforeClosing: string);
}
export declare class Property {
    readonly type: string;
    readonly key: PropertyKey;
    readonly computed: boolean;
    readonly value: PropertyValue | null;
    readonly kind: 'init' | 'get' | 'set';
    readonly method: boolean;
    readonly shorthand: boolean;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly wsBeforeGetSet: string;
    readonly wsBeforeColon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(kind: 'init' | 'get' | 'set', key: PropertyKey, wsBeforeGetSet: string, wsBeforeOpening: string, wsBeforeClosing: string, wsBeforeColon: string, computed: boolean, value: PropertyValue | null, method: boolean, shorthand: boolean);
}
export declare class RegexLiteral {
    readonly type: string;
    readonly value: RegExp;
    readonly raw: string;
    readonly regex: {
        pattern: string;
        flags: string;
    };
    readonly original: {
        pattern: string;
        flags: string;
    };
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, value: RegExp, raw: string, pattern: string, flags: string);
}
export declare class RestElement {
    readonly type: string;
    readonly argument: BindingIdentifier | BindingPattern;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, argument: BindingIdentifier | BindingPattern);
}
export declare class ReturnStatement {
    readonly type: string;
    readonly argument: Expression | null;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, argument: Expression | null, semicolon: string);
}
export declare class Script {
    readonly type: string;
    readonly body: StatementListItem[];
    readonly sourceType: string;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(body: StatementListItem[], wsAfter: string);
}
export declare class SequenceExpression {
    readonly type: string;
    readonly expressions: Expression[];
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly parentheses: boolean;
    readonly separators: string[];
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(parentheses: boolean, wsBeforeOpening: string, expressions: Expression[], separators: string[], wsBeforeClosing: string);
}
export declare class SpreadElement {
    readonly type: string;
    readonly argument: Expression;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, argument: Expression);
}
export declare class StaticMemberExpression {
    readonly type: string;
    readonly computed: boolean;
    readonly object: Expression;
    readonly property: Expression;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    wsAfter: string;
    unparse(): any;
    constructor(object: Expression, wsBeforeOpening: string, property: Expression);
}
export declare class Super {
    readonly type: string;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string);
}
export declare class SwitchCase {
    readonly type: string;
    readonly test: Expression | null;
    readonly consequent: StatementListItem[];
    wsBefore: string;
    readonly wsBeforeColon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, test: Expression, wsBeforeColon: string, consequent: StatementListItem[]);
}
export declare class SwitchStatement {
    readonly type: string;
    readonly discriminant: Expression;
    readonly cases: SwitchCase[];
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly wsBeforeBlockOpening: string;
    readonly wsBeforeBlockClosing: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeOpening: string, discriminant: Expression, wsBeforeClosing: string, wsBeforeBlockOpening: string, cases: SwitchCase[], wsBeforeBlockClosing: string);
}
export declare class TaggedTemplateExpression {
    readonly type: string;
    readonly tag: Expression;
    readonly quasi: TemplateLiteral;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(tag: Expression, quasi: TemplateLiteral);
}
interface TemplateElementValue {
    cooked: string;
    raw: string;
}
export declare class TemplateElement {
    readonly type: string;
    readonly value: TemplateElementValue;
    readonly originalCooked: string;
    readonly tail: boolean;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(value: TemplateElementValue, tail: boolean);
}
export declare class TemplateLiteral {
    readonly type: string;
    readonly quasis: TemplateElement[];
    readonly expressions: Expression[];
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, quasis: TemplateElement[], expressions: Expression[]);
}
export declare class ThisExpression {
    readonly type: string;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string);
}
export declare class ThrowStatement {
    readonly type: string;
    readonly argument: Expression;
    wsBefore: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, argument: Expression, semicolon: string);
}
export declare class TryStatement {
    readonly type: string;
    readonly block: BlockStatement;
    readonly handler: CatchClause | null;
    readonly finalizer: BlockStatement | null;
    wsBefore: string;
    readonly wsBeforeFinally: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, block: BlockStatement, handler: CatchClause | null, wsBeforeFinally: string, finalizer: BlockStatement | null);
}
export declare class UnaryExpression {
    readonly type: string;
    readonly operator: string;
    readonly argument: Expression;
    readonly prefix: boolean;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, operator: any, argument: any);
}
export declare class UpdateExpression {
    readonly type: string;
    readonly operator: string;
    readonly argument: Expression;
    readonly prefix: boolean;
    wsBefore: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, operator: any, argument: any, prefix: any);
}
export declare class VariableDeclaration {
    readonly type: string;
    readonly declarations: VariableDeclarator[];
    readonly kind: string;
    wsBefore: string;
    readonly separators: string[];
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, declarations: VariableDeclarator[], separators: string[], kind: string, semicolon: string);
}
export declare class VariableDeclarator {
    readonly type: string;
    readonly id: BindingIdentifier | BindingPattern;
    readonly init: Expression | null;
    wsBefore: string;
    readonly wsBeforeEq: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(id: BindingIdentifier | BindingPattern, wsBeforeEq: string, init: Expression | null);
}
export declare class WhileStatement {
    readonly type: string;
    readonly test: Expression;
    readonly body: Statement;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeOpening: string, test: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class WithStatement {
    readonly type: string;
    readonly object: Expression;
    readonly body: Statement;
    wsBefore: string;
    readonly wsBeforeOpening: string;
    readonly wsBeforeClosing: string;
    readonly closingParens: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeOpening: string, object: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class YieldExpression {
    readonly type: string;
    readonly argument: Expression | null;
    readonly delegate: boolean;
    wsBefore: string;
    readonly wsBeforeStar: string;
    readonly semicolon: string;
    wsAfter: string;
    unparse(parent?: Unparsable): string;
    constructor(wsBefore: string, wsBeforeStar: string, argument: Expression | null, delegate: boolean, semicolon: string);
}
export {};
