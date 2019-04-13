export declare function parse(code: string, options?: any, delegate?: any): any;
export declare function parseModule(code: string, options?: any, delegate?: any): any;
export declare function parseScript(code: string, options?: any, delegate?: any): any;
export declare function tokenize(code: string, options: any, delegate: any): any;
export { Syntax } from './syntax';
import * as Node from './nodes';
export { Node };
export declare const version = "4.0.0-dev";
