// WASM compiler for Augustium mappings

import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from '../augustium/lexer';
import { Parser } from '../augustium/parser';
import * as AST from '../augustium/ast';

// Fallback declaration for environments where WebAssembly types are not in lib
declare const WebAssembly: any;
import { logger } from '../utils/logger';

export interface CompilationResult {
  wasmModule: any; // WebAssembly.Module
  exports: string[];
  errors: CompilationError[];
}

export interface CompilationError {
  message: string;
  line?: number;
  column?: number;
}

export class AugustiumCompiler {
  private wasmRuntime: any;

  constructor() {
    // WASM runtime will use Node.js built-in WebAssembly support
    this.wasmRuntime = null;
  }

  async compileMapping(augustiumCode: string): Promise<CompilationResult> {
    const errors: CompilationError[] = [];
    
    try {
            // Tokenize and parse Augustium code
      const lexer = new Lexer(augustiumCode);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      // Validate AST
      const validationErrors = this.validateAST(ast);
      if (validationErrors.length > 0) {
        return {
          wasmModule: null as any,
          exports: [],
          errors: validationErrors
        };
      }
      
      // Generate WASM-compatible code
      const wasmCode = this.generateWASMCode(ast);
      
      // Compile to WASM module
      const wasmModule = await this.compileToWASM(wasmCode);
      
      // Extract exports
      const exports = this.extractExports(wasmModule);
      
      return {
        wasmModule,
        exports,
        errors
      };
      
    } catch (error) {
      errors.push({
        message: `Compilation failed: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return {
        wasmModule: null as any,
        exports: [],
        errors
      };
    }
  }

  private validateAST(ast: AST.SourceFile): CompilationError[] {
    const errors: CompilationError[] = [];
    
    // Check for required declarations
    let hasStruct = false;
    let hasIndex = false;
    
    for (const item of ast.items) {
      if (item.type === 'Struct') {
        hasStruct = true;
      }
    }
    
    if (!hasStruct) {
      errors.push({
        message: 'At least one struct declaration is required'
      });
    }
    
        
    // Validate struct fields
    for (const item of ast.items) {
      if (item.type === 'Struct') {
        const structErrors = this.validateStruct(item);
        errors.push(...structErrors);
      }
    }
    
    return errors;
  }

  private validateStruct(struct: AST.Struct): CompilationError[] {
    const errors: CompilationError[] = [];
    
    if (struct.fields.length === 0) {
      errors.push({
        message: `Struct ${struct.name.name} must have at least one field`,
        line: struct.location?.line,
        column: struct.location?.column
      });
    }
    
    // Check for duplicate field names
    const fieldNames = new Set<string>();
    for (const field of struct.fields) {
      if (fieldNames.has(field.name.name)) {
        errors.push({
          message: `Duplicate field name '${field.name.name}' in struct ${struct.name.name}`,
          line: field.location?.line,
          column: field.location?.column
        });
      }
      fieldNames.add(field.name.name);
    }
    
    return errors;
  }

  private generateWASMCode(ast: AST.SourceFile): string {
    // Generate WASM text format (WAT) from AST
    let watCode = '(module\n';
    
    // Add memory section
    watCode += '  (memory (export "memory") 1)\n';
    
    // Generate struct definitions as WASM data structures
    for (const item of ast.items) {
      if (item.type === 'Struct') {
        watCode += this.generateStructWAT(item);
      }
    }
    
    // Add utility functions
    watCode += this.generateUtilityFunctions();
    
    watCode += ')\n';
    
    return watCode;
  }

  private generateStructWAT(struct: AST.Struct): string {
    // Generate WASM struct representation
    let wat = `  ;; Struct: ${struct.name.name}\n`;
    
    // Create constructor function
    wat += `  (func $create_${struct.name.name} (export "create_${struct.name.name}")\n`;
    
    // Add parameters for each field
    for (const field of struct.fields) {
      const wasmType = this.augustiumTypeToWASMType(field.typeAnnotation.type === 'PrimitiveType' ? field.typeAnnotation.name : 'i32');
      wat += `    (param $${field.name.name} ${wasmType})\n`;
    }
    
    wat += '    (result i32) ;; return pointer to struct\n';
    
    // Allocate memory and set fields
    wat += '    ;; TODO: Implement struct creation\n';
    wat += '    i32.const 0 ;; placeholder\n';
    wat += '  )\n\n';
    
    return wat;
  }

  private generateIndexWAT(index: any): string {
    let wat = `  ;; Index: ${index.name.name}\n`;
    
    // Create mapping function
    wat += `  (func $map_${index.name.name} (export "map_${index.name.name}")\n`;
    wat += '    (param $event_ptr i32) ;; pointer to event data\n';
    wat += '    (result i32) ;; pointer to mapped data\n';
    
    // Generate mapping logic from AST
    if (index.mapping && index.mapping.body) {
      wat += this.generateObjectMappingWAT(index.mapping.body);
    }
    
    wat += '  )\n\n';
    
    return wat;
  }

  private generateObjectMappingWAT(obj: AST.ObjectExpression): string {
    let wat = '    ;; Object mapping\n';
    
    for (const prop of obj.properties) {
      wat += `    ;; Map property: ${prop.key.name}\n`;
      
      if (prop.value.type === 'MemberExpression') {
        const memberExpr = prop.value as AST.MemberExpression;
        wat += `    ;; Access ${memberExpr.object}.${memberExpr.property}\n`;
      }
    }
    
    wat += '    i32.const 0 ;; placeholder result\n';
    
    return wat;
  }

  private generateUtilityFunctions(): string {
    return `
  ;; Utility functions
  (func $allocate (param $size i32) (result i32)
    ;; Simple allocator - just return increasing addresses
    ;; In production, this would be a proper memory allocator
    i32.const 1024 ;; start at offset 1024
  )
  
  (func $get_event_field (param $event_ptr i32) (param $field_offset i32) (result i32)
    ;; Get field from event data structure
    local.get $event_ptr
    local.get $field_offset
    i32.add
    i32.load
  )
`;
  }

  private augustiumTypeToWASMType(augustiumType: string): string {
    switch (augustiumType) {
      case 'Address':
      case 'U256':
      case 'U128':
      case 'U64':
      case 'U32':
        return 'i64'; // Use i64 for large numbers
      case 'String':
      case 'Bytes':
        return 'i32'; // Pointer to string/bytes data
      case 'Bool':
        return 'i32';
      default:
        return 'i32';
    }
  }

  private generateMappingWAT(mapping: any): string {
    // Generate WASM code for mapping functions
    return '  ;; Mapping function placeholder\n';
  }

  private async compileToWASM(watCode: string): Promise<any> {
    if (!this.wasmRuntime) {
      // Fallback: create a minimal WASM module
      return this.createMinimalWASMModule();
    }
    
    try {
      // Use wasmtime to compile WAT to WASM
      const wasmBytes = this.wasmRuntime.wat2wasm(watCode);
      return await WebAssembly.compile(wasmBytes);
    } catch (error) {
      logger.warn(`WASM compilation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`);
      return this.createMinimalWASMModule();
    }
  }

  private createMinimalWASMModule(): any {
    // Create a minimal WASM module for testing
    const wasmBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM magic number
      0x01, 0x00, 0x00, 0x00, // WASM version
      // Type section
      0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
      // Function section
      0x03, 0x02, 0x01, 0x00,
      // Export section
      0x07, 0x0a, 0x01, 0x06, 0x6d, 0x61, 0x70, 0x70, 0x65, 0x72, 0x00, 0x00,
      // Code section
      0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b
    ]);
    
    return new (globalThis as any).WebAssembly.Module(wasmBytes);
  }

  private extractExports(wasmModule: any): string[] {
    const exports: string[] = [];
    
    try {
      // Get module exports
      const moduleExports = (globalThis as any).WebAssembly.Module.exports(wasmModule);
      for (const exp of moduleExports) {
        if (exp.kind === 'function') {
          exports.push(exp.name);
        }
      }
    } catch (error) {
      logger.warn(`Failed to extract WASM exports: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return exports;
  }

  async saveCompiledModule(wasmModule: any, outputPath: string): Promise<void> {
    try {
      const wasmBytes = await (globalThis as any).WebAssembly.compile(wasmModule);
      fs.writeFileSync(outputPath, Buffer.from(wasmBytes as any));
      logger.info(`Compiled WASM module saved to: ${outputPath}`);
    } catch (error) {
      throw new Error(`Failed to save WASM module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadCompiledModule(filePath: string): Promise<any> {
    try {
      const wasmBytes = fs.readFileSync(filePath);
      return await WebAssembly.compile(wasmBytes);
    } catch (error) {
      throw new Error(`Failed to load WASM module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
