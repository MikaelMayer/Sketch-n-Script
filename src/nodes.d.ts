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
    type: string;
    wsAfter: string;
}
export declare type UnparsableOrNull = Unparsable | null;
export declare let unparseChildren: (parent?: any, join?: string | string[], defaultJoin?: string) => (children: UnparsableOrNull[]) => string;
export declare let unparseChild: (parent?: any) => (node: UnparsableOrNull) => string;
export declare class ArrayExpression {
    type: string;
    elements: ArrayExpressionElement[];
    wsBefore: string;
    wsBeforeClosing: string;
    separators: string[];
    wsAfter: string;
    constructor(wsBefore: string, elements: ArrayExpressionElement[], separators: string[], wsBeforeClosing: string);
}
export declare class ArrayPattern {
    type: string;
    elements: ArrayPatternElement[];
    wsBefore: string;
    wsBeforeClosing: string;
    separators: string[];
    wsAfter: string;
    constructor(wsBefore: string, elements: ArrayPatternElement[], separators: string[], wsBeforeClosing: string);
}
export declare class ArrowFunctionExpression {
    type: string;
    id: Identifier | null;
    params: FunctionParameter[];
    body: BlockStatement | Expression;
    generator: boolean;
    expression: boolean;
    async: boolean;
    noparens: boolean;
    wsBefore: string;
    wsBeforeAsync: string;
    wsBeforeOpening: string;
    separators: string[];
    wsBeforeClosing: string;
    wsBeforeArrow: string;
    arrow: string;
    wsAfter: string;
    constructor(wsBeforeOpening: string, params: FunctionParameter[], separators: string[], wsBeforeClosing: string, noparens: boolean, wsBeforeArrow: string, body: BlockStatement | Expression, expression: boolean);
}
export declare class AssignmentExpression {
    type: string;
    operator: string;
    left: Expression;
    right: Expression;
    wsBefore: string;
    wsBeforeOp: string;
    wsAfter: string;
    constructor(wsBeforeOp: string, operator: string, left: Expression, right: Expression);
}
export declare class AssignmentPattern {
    type: string;
    left: BindingIdentifier | BindingPattern;
    right: Expression;
    wsBefore: string;
    wsBeforeOp: string;
    wsAfter: string;
    constructor(left: BindingIdentifier | BindingPattern, wsBeforeOp: string, right: Expression);
}
export declare class AsyncArrowFunctionExpression {
    type: string;
    id: Identifier | null;
    params: FunctionParameter[];
    body: BlockStatement | Expression;
    generator: boolean;
    expression: boolean;
    async: boolean;
    noparens: boolean;
    wsBefore: string;
    wsBeforeAsync: string;
    wsBeforeOpening: string;
    separators: string[];
    wsBeforeClosing: string;
    wsBeforeArrow: string;
    arrow: string;
    wsAfter: string;
    constructor(wsBeforeAsync: string, wsBeforeOpening: string, params: FunctionParameter[], separators: string[], wsBeforeClosing: string, noparens: boolean, wsBeforeArrow: string, body: BlockStatement | Expression, expression: boolean);
}
export declare type AnyFunctionExpression = AsyncFunctionDeclaration | FunctionDeclaration | AsyncFunctionExpression | FunctionExpression;
export declare class AsyncFunctionDeclaration {
    type: string;
    id: Identifier | null;
    params: FunctionParameter[];
    body: BlockStatement;
    generator: boolean;
    expression: boolean;
    async: boolean;
    wsBefore: string;
    wsBeforeAsync: string;
    wsBeforeFunction: string;
    wsBeforeStar: string;
    wsBeforeParams: string;
    separators: string[];
    wsBeforeEndParams: string;
    wsAfter: string;
    constructor(wsBeforeAsync: string, wsBeforeFunction: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement);
}
export declare class AsyncFunctionExpression {
    type: string;
    id: Identifier | null;
    params: FunctionParameter[];
    body: BlockStatement;
    generator: boolean;
    expression: boolean;
    async: boolean;
    wsBefore: string;
    wsBeforeAsync: string;
    wsBeforeFunction: string;
    wsBeforeStar: string;
    wsBeforeParams: string;
    separators: string[];
    wsBeforeEndParams: string;
    wsAfter: string;
    constructor(wsBeforeAsync: string, wsBeforeFunction: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement);
}
export declare class AwaitExpression {
    type: string;
    argument: Expression;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, argument: Expression);
}
export declare class BinaryExpression {
    type: string;
    operator: string;
    left: Expression;
    right: Expression;
    wsBefore: string;
    wsBeforeOp: string;
    wsAfter: string;
    constructor(operator: string, left: Expression, right: Expression, wsBeforeOp: string);
}
export declare class BlockStatement {
    type: string;
    body: StatementListItem[];
    wsBefore: string;
    wsBeforeEnd: string;
    wsAfter: string;
    constructor(wsBefore: string, body: StatementListItem[], wsBeforeEnd: string);
}
export declare class BreakStatement {
    type: string;
    label: Identifier | null;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, label: Identifier | null, semicolon: string);
}
export declare class CallExpression {
    type: string;
    callee: Expression | Import;
    arguments: ArgumentListElement[];
    wsBefore: string;
    wsBeforeArgs: string;
    separators: string[];
    wsBeforeEndArgs: string;
    wsAfter: string;
    constructor(callee: Expression | Import, wsBeforeArgs: string, args: ArgumentListElement[], separators: string[], wsBeforeEndArgs: string);
}
export declare class CatchClause {
    type: string;
    param: BindingIdentifier | BindingPattern;
    body: BlockStatement;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeOpening: string, param: BindingIdentifier | BindingPattern, wsBeforeClosing: string, body: BlockStatement);
}
export declare class ClassBody {
    type: string;
    body: Property[];
    wsBefore: string;
    wsBeforeOpening: string;
    wsAfterOpening: string;
    wsBeforeClosing: string;
    wsAfter: string;
    constructor(wsBeforeOpening: string, wsAfterOpening: string, body: Property[], wsBeforeClosing: string);
}
export declare class ClassDeclaration {
    type: string;
    id: Identifier | null;
    superClass: Identifier | null;
    body: ClassBody;
    wsBefore: string;
    wsBeforeExtends: string;
    wsAfter: string;
    constructor(wsBefore: string, id: Identifier | null, wsBeforeExtends: string, superClass: Identifier | null, body: ClassBody);
}
export declare class ClassExpression {
    type: string;
    id: Identifier | null;
    superClass: Identifier | null;
    body: ClassBody;
    wsBefore: string;
    wsBeforeExtends: string;
    wsAfter: string;
    constructor(wsBefore: string, id: Identifier | null, wsBeforeExtends: string, superClass: Identifier | null, body: ClassBody);
}
export declare class ComputedMemberExpression {
    type: string;
    computed: boolean;
    object: Expression;
    property: Expression;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsAfter: string;
    constructor(object: Expression, wsBeforeOpening: string, property: Expression, wsBeforeClosing: string);
}
export declare class ConditionalExpression {
    type: string;
    test: Expression;
    consequent: Expression;
    alternate: Expression;
    wsBefore: string;
    wsBeforeQues: string;
    wsBeforeColon: string;
    wsAfter: string;
    constructor(test: Expression, wsBeforeQues: string, consequent: Expression, wsBeforeColon: string, alternate: Expression);
}
export declare class ContinueStatement {
    type: string;
    label: Identifier | null;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, label: Identifier | null, semicolon: string);
}
export declare class DebuggerStatement {
    type: string;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, semicolon: string);
}
export declare class Directive {
    type: string;
    expression: Expression;
    directive: string;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(expression: Expression, directive: string, semicolon: string);
}
export declare class DoWhileStatement {
    type: string;
    body: Statement;
    test: Expression;
    wsBefore: string;
    wsBeforeWhile: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    closingParens: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, body: Statement, wsBeforeWhile: string, wsBeforeOpening: string, test: Expression, wsBeforeClosing: string, semicolon: string, closingParens?: string);
}
export declare class EmptyStatement {
    type: string;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, semicolon?: string);
}
export declare class ExportAllDeclaration {
    type: string;
    source: Literal;
    wsBefore: string;
    wsBeforeStar: string;
    wsBeforeFrom: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeStar: string, wsBeforeFrom: string, source: Literal, semicolon?: string);
}
export declare class ExportDefaultDeclaration {
    type: string;
    declaration: ExportableDefaultDeclaration;
    wsBefore: string;
    wsBeforeDefault: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeDefault: string, declaration: ExportableDefaultDeclaration, semicolon?: string);
}
export declare class ExportNamedDeclaration {
    type: string;
    declaration: ExportableNamedDeclaration | null;
    specifiers: ExportSpecifier[];
    source: Literal | null;
    wsBefore: string;
    hasBrackets: boolean;
    wsBeforeOpening: string;
    separators: string[];
    wsBeforeClosing: string;
    wsBeforeFrom: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, declaration: ExportableNamedDeclaration | null, hasBrackets: boolean, wsBeforeOpening: string, specifiers: ExportSpecifier[], separators: string[], wsBeforeClosing: string, wsBeforeFrom: string, source: Literal | null, semicolon?: string);
}
export declare class ExportSpecifier {
    type: string;
    exported: Identifier;
    local: Identifier;
    noAs: boolean;
    wsBefore: string;
    wsBeforeAs: string;
    wsAfter: string;
    constructor(local: Identifier, noAs: boolean, wsBeforeAs: string, exported: Identifier);
}
export declare class ExpressionStatement {
    type: string;
    expression: Expression;
    semicolon: string;
    wsBefore: string;
    wsAfter: string;
    constructor(expression: Expression, semicolon: string);
}
export declare class ForInStatement {
    type: string;
    left: Expression;
    right: Expression;
    body: Statement;
    each: boolean;
    wsBefore: string;
    wsBeforeFor: string;
    wsBeforeOpening: string;
    wsBeforeKeyword: string;
    wsBeforeClosing: string;
    closingParens: string;
    wsAfter: string;
    constructor(wsBeforeFor: string, wsBeforeOpening: string, left: Expression, wsBeforeKeyword: string, right: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class ForOfStatement {
    type: string;
    left: Expression;
    right: Expression;
    body: Statement;
    wsBefore: string;
    wsBeforeFor: string;
    wsBeforeOpening: string;
    wsBeforeKeyword: string;
    wsBeforeClosing: string;
    closingParens: string;
    wsAfter: string;
    constructor(wsBeforeFor: string, wsBeforeOpening: string, left: Expression, wsBeforeKeyword: string, right: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class ForStatement {
    type: string;
    init: Expression | null;
    test: Expression | null;
    update: Expression | null;
    body: Statement;
    wsBefore: string;
    wsBeforeFor: string;
    wsBeforeOpening: string;
    wsBeforeSemicolon1: string;
    wsBeforeSemicolon2: string;
    wsBeforeClosing: string;
    closingParens: string;
    wsAfter: string;
    constructor(wsBeforeFor: string, wsBeforeOpening: string, init: Expression | null, wsBeforeSemicolon1: string, test: Expression | null, wsBeforeSemicolon2: string, update: Expression | null, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class FunctionDeclaration {
    type: string;
    id: Identifier | null;
    params: FunctionParameter[];
    body: BlockStatement;
    generator: boolean;
    expression: boolean;
    async: boolean;
    wsBefore: string;
    wsBeforeAsync: string;
    wsBeforeFunction: string;
    wsBeforeStar: string;
    wsBeforeParams: string;
    separators: string[];
    wsBeforeEndParams: string;
    wsAfter: string;
    constructor(wsBeforeFunction: string, wsBeforeStar: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement, generator: boolean);
}
export declare class FunctionExpression {
    type: string;
    id: Identifier | null;
    params: FunctionParameter[];
    body: BlockStatement;
    generator: boolean;
    expression: boolean;
    async: boolean;
    wsBefore: string;
    wsBeforeAsync: string;
    wsBeforeFunction: string;
    wsBeforeStar: string;
    wsBeforeParams: string;
    separators: string[];
    wsBeforeEndParams: string;
    wsAfter: string;
    constructor(wsBeforeFunction: string, wsBeforeStar: string, id: Identifier | null, wsBeforeParams: string, params: FunctionParameter[], separators: string[], wsBeforeEndParams: string, body: BlockStatement, generator: boolean);
}
export declare class Identifier {
    type: string;
    name: string;
    original: string;
    nameRaw: string;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, name: string, nameRaw?: string);
}
export declare class IfStatement {
    type: string;
    ifKeyword: string;
    test: Expression;
    consequent: Statement;
    alternate: Statement | null;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    closingParens: string;
    wsBeforeElse: string;
    wsAfter: string;
    constructor(wsBefore: string, ifKeyword: string, wsBeforeOpening: string, test: Expression, wsBeforeClosing: string, consequent: Statement, wsBeforeElse: string, alternate: Statement | null, closingParens?: string);
}
export declare class Import {
    type: string;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: any);
}
export declare class ImportDeclaration {
    type: string;
    specifiers: ImportDeclarationSpecifier[];
    source: Literal;
    wsBefore: string;
    hasBrackets: boolean;
    separators: string[];
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsBeforeFrom: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeOpening: string, hasBrackets: boolean, specifiers: ImportDeclarationSpecifier[], separators: string[], wsBeforeClosing: string, wsBeforeFrom: string, source: any, semicolon?: string);
}
export declare class ImportDefaultSpecifier {
    type: string;
    local: Identifier;
    wsBefore: string;
    wsAfter: string;
    constructor(local: Identifier);
}
export declare class ImportNamespaceSpecifier {
    type: string;
    local: Identifier;
    wsBefore: string;
    wsBeforeAs: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeAs: string, local: Identifier);
}
export declare class ImportSpecifier {
    type: string;
    local: Identifier;
    imported: Identifier;
    asPresent: boolean;
    wsBefore: string;
    wsBeforeAs: string;
    wsAfter: string;
    constructor(local: Identifier, asPresent: boolean, wsBeforeAs: string, imported: Identifier);
}
export declare class LabeledStatement {
    type: string;
    label: Identifier;
    body: Statement | ClassDeclaration;
    wsBefore: string;
    wsBeforeColon: string;
    wsAfter: string;
    constructor(label: Identifier, wsBeforeColon: string, body: Statement | ClassDeclaration);
}
export declare function uneval(x: any): string;
export declare class Literal {
    type: string;
    value: boolean | number | string | null;
    raw: string;
    original: boolean | number | string | null;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, value: boolean | number | string | null, raw: string);
}
export declare class MetaProperty {
    type: string;
    meta: Identifier;
    property: Identifier;
    wsBefore: string;
    wsBeforeDot: string;
    wsAfter: string;
    constructor(meta: Identifier, wsBeforeDot: string, property: Identifier);
}
export declare class MethodDefinition {
    type: string;
    key: Expression;
    computed: boolean;
    value: AsyncFunctionExpression | FunctionExpression | null;
    kind: 'init' | 'method' | 'constructor' | 'set' | 'get';
    static: boolean;
    wsBefore: string;
    wsBeforeGetSet: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsBeforeStatic: string;
    wsAfter: string;
    constructor(wsBeforeStatic: string, wsBeforeGetSet: any, key: Expression, computed: boolean, wsBeforeOpening: string, wsBeforeClosing: string, value: AsyncFunctionExpression | FunctionExpression | null, kind: 'init' | 'method' | 'constructor' | 'set' | 'get', isStatic: boolean);
}
export declare class Module {
    type: string;
    body: StatementListItem[];
    sourceType: string;
    wsBefore: string;
    wsAfter: string;
    constructor(body: StatementListItem[], wsAfter: string);
}
export declare class NewExpression {
    type: string;
    callee: Expression;
    arguments: ArgumentListElement[];
    wsBefore: string;
    wsBeforeNew: string;
    parentheses: boolean;
    wsBeforeOpening: string;
    separators: string[];
    wsBeforeClosing: string;
    wsAfter: string;
    constructor(wsBeforeNew: string, callee: Expression, parentheses: boolean, wsBeforeOpening: string, args: ArgumentListElement[], separators: string[], wsBeforeClosing: string);
}
export declare class ObjectExpression {
    type: string;
    properties: ObjectExpressionProperty[];
    wsBefore: string;
    wsBeforeClosing: string;
    separators: string[];
    wsAfter: string;
    constructor(wsBefore: string, properties: ObjectExpressionProperty[], separators: string[], wsBeforeClosing: string);
}
export declare class ObjectPattern {
    type: string;
    properties: ObjectPatternProperty[];
    wsBefore: string;
    separators: string[];
    wsBeforeClosing: string;
    wsAfter: string;
    constructor(wsBefore: string, properties: ObjectPatternProperty[], separators: string[], wsBeforeClosing: string);
}
export declare class Property {
    type: string;
    key: PropertyKey;
    computed: boolean;
    value: PropertyValue | null;
    kind: 'init' | 'get' | 'set';
    method: boolean;
    shorthand: boolean;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsBeforeGetSet: string;
    wsBeforeColon: string;
    wsAfter: string;
    constructor(kind: 'init' | 'get' | 'set', key: PropertyKey, wsBeforeGetSet: string, wsBeforeOpening: string, wsBeforeClosing: string, wsBeforeColon: string, computed: boolean, value: PropertyValue | null, method: boolean, shorthand: boolean);
}
export declare class RegexLiteral {
    type: string;
    value: RegExp;
    raw: string;
    regex: {
        pattern: string;
        flags: string;
    };
    original: {
        pattern: string;
        flags: string;
    };
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, value: RegExp, raw: string, pattern: string, flags: string);
}
export declare class RestElement {
    type: string;
    argument: BindingIdentifier | BindingPattern;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, argument: BindingIdentifier | BindingPattern);
}
export declare class ReturnStatement {
    type: string;
    argument: Expression | null;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, argument: Expression | null, semicolon: string);
}
export declare class Script {
    type: string;
    body: StatementListItem[];
    sourceType: string;
    wsBefore: string;
    wsAfter: string;
    constructor(body: StatementListItem[], wsAfter: string);
}
export declare class SequenceExpression {
    type: string;
    expressions: Expression[];
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    parentheses: boolean;
    separators: string[];
    wsAfter: string;
    constructor(parentheses: boolean, wsBeforeOpening: string, expressions: Expression[], separators: string[], wsBeforeClosing: string);
}
export declare class SpreadElement {
    type: string;
    argument: Expression;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, argument: Expression);
}
export declare class StaticMemberExpression {
    type: string;
    computed: boolean;
    object: Expression;
    property: Expression;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsAfter: string;
    constructor(object: Expression, wsBeforeOpening: string, property: Expression);
}
export declare class Super {
    type: string;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string);
}
export declare class SwitchCase {
    type: string;
    test: Expression | null;
    consequent: StatementListItem[];
    wsBefore: string;
    wsBeforeColon: string;
    wsAfter: string;
    constructor(wsBefore: string, test: Expression, wsBeforeColon: string, consequent: StatementListItem[]);
}
export declare class SwitchStatement {
    type: string;
    discriminant: Expression;
    cases: SwitchCase[];
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    wsBeforeBlockOpening: string;
    wsBeforeBlockClosing: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeOpening: string, discriminant: Expression, wsBeforeClosing: string, wsBeforeBlockOpening: string, cases: SwitchCase[], wsBeforeBlockClosing: string);
}
export declare class TaggedTemplateExpression {
    type: string;
    tag: Expression;
    quasi: TemplateLiteral;
    wsBefore: string;
    wsAfter: string;
    constructor(tag: Expression, quasi: TemplateLiteral);
}
interface TemplateElementValue {
    cooked: string;
    raw: string;
}
export declare class TemplateElement {
    type: string;
    value: TemplateElementValue;
    originalCooked: string;
    tail: boolean;
    wsBefore: string;
    wsAfter: string;
    constructor(value: TemplateElementValue, tail: boolean);
}
export declare class TemplateLiteral {
    type: string;
    quasis: TemplateElement[];
    expressions: Expression[];
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, quasis: TemplateElement[], expressions: Expression[]);
}
export declare class ThisExpression {
    type: string;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string);
}
export declare class ThrowStatement {
    type: string;
    argument: Expression;
    wsBefore: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, argument: Expression, semicolon: string);
}
export declare class TryStatement {
    type: string;
    block: BlockStatement;
    handler: CatchClause | null;
    finalizer: BlockStatement | null;
    wsBefore: string;
    wsBeforeFinally: string;
    wsAfter: string;
    constructor(wsBefore: string, block: BlockStatement, handler: CatchClause | null, wsBeforeFinally: string, finalizer: BlockStatement | null);
}
export declare class UnaryExpression {
    type: string;
    operator: string;
    argument: Expression;
    prefix: boolean;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, operator: any, argument: any);
}
export declare class UpdateExpression {
    type: string;
    operator: string;
    argument: Expression;
    prefix: boolean;
    wsBefore: string;
    wsAfter: string;
    constructor(wsBefore: string, operator: any, argument: any, prefix: any);
}
export declare class VariableDeclaration {
    type: string;
    declarations: VariableDeclarator[];
    kind: string;
    wsBefore: string;
    separators: string[];
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, declarations: VariableDeclarator[], separators: string[], kind: string, semicolon: string);
}
export declare class VariableDeclarator {
    type: string;
    id: BindingIdentifier | BindingPattern;
    init: Expression | null;
    wsBefore: string;
    wsBeforeEq: string;
    wsAfter: string;
    constructor(id: BindingIdentifier | BindingPattern, wsBeforeEq: string, init: Expression | null);
}
export declare class WhileStatement {
    type: string;
    test: Expression;
    body: Statement;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    closingParens: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeOpening: string, test: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class WithStatement {
    type: string;
    object: Expression;
    body: Statement;
    wsBefore: string;
    wsBeforeOpening: string;
    wsBeforeClosing: string;
    closingParens: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeOpening: string, object: Expression, wsBeforeClosing: string, body: Statement, closingParens?: string);
}
export declare class YieldExpression {
    type: string;
    argument: Expression | null;
    delegate: boolean;
    wsBefore: string;
    wsBeforeStar: string;
    semicolon: string;
    wsAfter: string;
    constructor(wsBefore: string, wsBeforeStar: string, argument: Expression | null, delegate: boolean, semicolon: string);
}
export declare var unparsers: any;
export declare function unparse(e: UnparsableOrNull | undefined, parent?: Unparsable): string;
export {};
