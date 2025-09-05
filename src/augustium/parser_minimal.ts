// Minimal Parser for Official Augustium Language

import { Token, TokenType } from './lexer';
import { 
  SourceFile, Item, Contract, Function, Struct, Enum, Trait, Impl, 
  UseDeclaration, ConstDeclaration, Module, Field, Parameter, 
  TypeParameter, EnumVariant, TraitFunction, AssociatedType, Event, EventField, Modifier,
  Identifier, Type, Expression, Statement, Block, SourceLocation
} from './ast';

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`Parse error at line ${token.line}, column ${token.column}: ${message}`);
  }
}

export class MinimalParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): SourceFile {
    const items: Item[] = [];
    
    while (!this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      const item = this.parseItem();
      if (item) {
        items.push(item);
      }
    }
    
    return {
      type: 'SourceFile',
      items,
      location: { line: 1, column: 1 }
    };
  }

  private parseItem(): Item | null {
    try {
      if (this.match(TokenType.CONTRACT)) {
        return this.parseContract();
      }
      
      if (this.match(TokenType.FN)) {
        return this.parseFunction();
      }
      
      if (this.match(TokenType.STRUCT)) {
        return this.parseStruct();
      }

      if (this.match(TokenType.ENUM)) {
        return this.parseEnum();
      }

      if (this.match(TokenType.TRAIT)) {
        return this.parseTrait();
      }

      if (this.match(TokenType.IMPL)) {
        return this.parseImpl();
      }

      if (this.match(TokenType.USE)) {
        return this.parseUse();
      }

      if (this.match(TokenType.CONST)) {
        return this.parseConst();
      }

      if (this.match(TokenType.MOD)) {
        return this.parseModule();
      }

      // Skip unknown tokens
      this.advance();
      return null;
    } catch (error) {
      this.synchronize();
      return null;
    }
  }

  private parseContract(): Contract {
    const name = this.parseIdentifier();
    
    this.consume(TokenType.LeftBrace, "Expected '{' after contract name");
    
    const fields: Field[] = [];
    const functions: Function[] = [];
    const events: Event[] = [];
    const modifiers: Modifier[] = [];
    
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      if (this.check(TokenType.LET)) {
        fields.push(this.parseField());
      } else if (this.check(TokenType.FN)) {
        functions.push(this.parseFunction());
      } else if (this.check(TokenType.EVENT)) {
        events.push(this.parseEvent());
      } else {
        this.advance(); // Skip unknown tokens
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after contract body");
    
    return {
      type: 'Contract',
      name,
      fields,
      functions,
      events,
      modifiers,
      location: this.getLocation()
    };
  }

  private parseFunction(): Function {
    const name = this.parseIdentifier();
    const typeParameters: TypeParameter[] = [];
    
    this.consume(TokenType.LeftParen, "Expected '(' after function name");
    
    const parameters: Parameter[] = [];
    if (!this.check(TokenType.RightParen)) {
      do {
        parameters.push(this.parseParameter());
      } while (this.match(TokenType.Comma));
    }
    
    this.consume(TokenType.RightParen, "Expected ')' after parameters");
    
    let returnType: Type | undefined = undefined;
    if (this.match(TokenType.Arrow)) {
      returnType = this.parseType();
    }
    
    const body: Statement[] = this.parseBlock();
    const blockBody = {
      type: 'Block' as const,
      statements: body,
      location: this.getLocation()
    };
    
    return {
      type: 'Function',
      name,
      typeParameters,
      parameters,
      returnType,
      body: blockBody,
      visibility: 'private',
      isAsync: false,
      mutability: 'immutable',
      attributes: [],
      location: this.getLocation()
    };
  }

  private parseStruct(): Struct {
    const name = this.parseIdentifier();
    const typeParameters: TypeParameter[] = [];
    
    this.consume(TokenType.LeftBrace, "Expected '{' after struct name");
    
    const fields: Field[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      fields.push(this.parseField());
      
      if (!this.check(TokenType.RightBrace)) {
        this.match(TokenType.Comma);
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after struct fields");
    
    return {
      type: 'Struct',
      name,
      typeParameters,
      fields,
      visibility: 'private',
      location: this.getLocation()
    };
  }

  private parseEnum(): Enum {
    const name = this.parseIdentifier();
    
    this.consume(TokenType.LeftBrace, "Expected '{' after enum name");
    
    const variants: EnumVariant[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      const variantName = this.parseIdentifier();
      let fields: Type[] = [];
      
      if (this.match(TokenType.LeftBrace)) {
        while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
          fields.push(this.parseType());
          if (!this.check(TokenType.RightBrace)) {
            this.match(TokenType.Comma);
          }
        }
        this.consume(TokenType.RightBrace, "Expected '}' after variant fields");
      }
      
      variants.push({
        type: 'EnumVariant',
        name: variantName,
        fields,
        location: this.getLocation()
      });
      
      if (!this.check(TokenType.RightBrace)) {
        this.match(TokenType.Comma);
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after enum variants");
    
    return {
      type: 'Enum',
      name,
      variants,
      visibility: 'private',
      location: this.getLocation()
    };
  }

  private parseTrait(): Trait {
    const name = this.parseIdentifier();
    const typeParameters: TypeParameter[] = [];
    
    this.consume(TokenType.LeftBrace, "Expected '{' after trait name");
    
    const functions: TraitFunction[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      if (this.check(TokenType.FN)) {
        functions.push(this.parseTraitFunction());
      } else {
        this.advance(); // Skip unknown tokens
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after trait body");
    
    return {
      type: 'Trait',
      name,
      typeParameters,
      functions,
      associatedTypes: [],
      visibility: 'private',
      location: this.getLocation()
    };
  }

  private parseTraitFunction(): TraitFunction {
    this.consume(TokenType.FN, "Expected 'fn'");
    const name = this.parseIdentifier();
    
    this.consume(TokenType.LeftParen, "Expected '(' after function name");
    
    const parameters: Parameter[] = [];
    if (!this.check(TokenType.RightParen)) {
      do {
        parameters.push(this.parseParameter());
      } while (this.match(TokenType.Comma));
    }
    
    this.consume(TokenType.RightParen, "Expected ')' after parameters");
    
    let returnType: Type | undefined = undefined;
    if (this.match(TokenType.Arrow)) {
      returnType = this.parseType();
    }
    
    this.consume(TokenType.Semicolon, "Expected ';' after trait function signature");
    
    return {
      type: 'TraitFunction',
      name,
      parameters,
      returnType,
      location: this.getLocation()
    };
  }

  private parseImpl(): Impl {
    let traitName: Identifier | undefined = undefined;
    let typeName: Identifier;
    
    if (this.check(TokenType.IDENTIFIER)) {
      const firstId = this.parseIdentifier();
      
      if (this.match(TokenType.FOR)) {
        traitName = firstId;
        typeName = this.parseIdentifier();
      } else {
        typeName = firstId;
      }
    } else {
      throw new ParseError("Expected type name in impl", this.peek());
    }
    
    this.consume(TokenType.LeftBrace, "Expected '{' after impl declaration");
    
    const functions: Function[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      if (this.check(TokenType.FN)) {
        functions.push(this.parseFunction());
      } else {
        this.advance(); // Skip unknown tokens
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after impl body");
    
    return {
      type: 'Impl',
      traitName,
      typeName,
      typeParameters: [],
      functions,
      location: this.getLocation()
    };
  }

  private parseUse(): UseDeclaration {
    const path: Identifier[] = [];
    
    do {
      path.push(this.parseIdentifier());
    } while (this.match(TokenType.DoubleColon));
    
    let alias: Identifier | undefined = undefined;
    if (this.match(TokenType.AS)) {
      alias = this.parseIdentifier();
    }
    
    this.consume(TokenType.Semicolon, "Expected ';' after use declaration");
    
    return {
      type: 'UseDeclaration',
      path,
      alias,
      location: this.getLocation()
    };
  }

  private parseConst(): ConstDeclaration {
    const name = this.parseIdentifier();
    this.consume(TokenType.Colon, "Expected ':' after const name");
    const typeAnnotation = this.parseType();
    this.consume(TokenType.Equal, "Expected '=' after const type");
    const value = this.parseExpression();
    this.consume(TokenType.Semicolon, "Expected ';' after const value");
    
    return {
      type: 'ConstDeclaration',
      name,
      typeAnnotation,
      value,
      visibility: 'private',
      location: this.getLocation()
    };
  }

  private parseModule(): Module {
    const name = this.parseIdentifier();
    
    this.consume(TokenType.LeftBrace, "Expected '{' after module name");
    
    const items: Item[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      const item = this.parseItem();
      if (item) {
        items.push(item);
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after module body");
    
    return {
      type: 'Module',
      name,
      items,
      visibility: 'private',
      location: this.getLocation()
    };
  }

  private parseField(): Field {
    const name = this.parseIdentifier();
    this.consume(TokenType.Colon, "Expected ':' after field name");
    const typeAnnotation = this.parseType();
    
    return {
      type: 'Field',
      name,
      typeAnnotation,
      visibility: 'private',
      location: this.getLocation()
    };
  }

  private parseParameter(): Parameter {
    const name = this.parseIdentifier();
    this.consume(TokenType.Colon, "Expected ':' after parameter name");
    const typeAnnotation = this.parseType();
    
    return {
      type: 'Parameter',
      name,
      typeAnnotation,
      location: this.getLocation()
    };
  }

  private parseEvent(): Event {
    this.consume(TokenType.EVENT, "Expected 'event'");
    const name = this.parseIdentifier();
    
    this.consume(TokenType.LeftBrace, "Expected '{' after event name");
    
    const fields: EventField[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      fields.push(this.parseEventField());
      
      if (!this.check(TokenType.RightBrace)) {
        this.match(TokenType.Comma);
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after event fields");
    
    return {
      type: 'Event',
      name,
      fields,
      location: this.getLocation()
    };
  }

  private parseEventField(): EventField {
    const indexed = this.match(TokenType.INDEXED);
    const name = this.parseIdentifier();
    this.consume(TokenType.Colon, "Expected ':' after event field name");
    const typeAnnotation = this.parseType();
    
    return {
      type: 'EventField',
      name,
      typeAnnotation,
      indexed,
      location: this.getLocation()
    };
  }

  private parseType(): Type {
    if (this.match(TokenType.IDENTIFIER)) {
      const typeName = this.previous().value;
      // Handle primitive types
      if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'i8', 'i16', 'i32', 'i64', 'i128', 'i256', 'bool', 'address', 'bytes', 'string'].includes(typeName)) {
        return {
          type: 'PrimitiveType',
          name: typeName as any,
          location: this.getLocation()
        };
      } else {
        return {
          type: 'ReferenceType',
          referent: { type: 'PrimitiveType', name: typeName as any, location: this.getLocation() },
          mutable: false,
          location: this.getLocation()
        };
      }
    }
    
    
    throw new ParseError("Expected type", this.peek());
  }

  private parseExpression(): Expression {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd();
    
    while (this.match(TokenType.Or)) {
      const operator = this.previous().value as any;
      const right = this.parseLogicalAnd();
      expr = {
        type: 'BinaryExpression',
        left: expr,
        operator,
        right,
        location: this.getLocation()
      };
    }
    
    return expr;
  }

  private parseLogicalAnd(): Expression {
    let expr = this.parseEquality();
    
    while (this.match(TokenType.And)) {
      const operator = this.previous().value as any;
      const right = this.parseEquality();
      expr = {
        type: 'BinaryExpression',
        left: expr,
        operator,
        right,
        location: this.getLocation()
      };
    }
    
    return expr;
  }

  private parseEquality(): Expression {
    let expr = this.parseComparison();
    
    while (this.match(TokenType.EqualEqual, TokenType.NotEqual)) {
      const operator = this.previous().value as any;
      const right = this.parseComparison();
      expr = {
        type: 'BinaryExpression',
        left: expr,
        operator,
        right,
        location: this.getLocation()
      };
    }
    
    return expr;
  }

  private parseComparison(): Expression {
    let expr = this.parseArithmetic();
    
    while (this.match(TokenType.Greater, TokenType.GreaterEqual, TokenType.Less, TokenType.LessEqual)) {
      const operator = this.previous().value as any;
      const right = this.parseArithmetic();
      expr = {
        type: 'BinaryExpression',
        left: expr,
        operator,
        right,
        location: this.getLocation()
      };
    }
    
    return expr;
  }

  private parseArithmetic(): Expression {
    let expr = this.parseTerm();
    
    while (this.match(TokenType.Plus, TokenType.Minus)) {
      const operator = this.previous().value as any;
      const right = this.parseTerm();
      expr = {
        type: 'BinaryExpression',
        left: expr,
        operator,
        right,
        location: this.getLocation()
      };
    }
    
    return expr;
  }

  private parseTerm(): Expression {
    let expr = this.parseUnary();
    
    while (this.match(TokenType.Star, TokenType.Slash)) {
      const operator = this.previous().value as any;
      const right = this.parseUnary();
      expr = {
        type: 'BinaryExpression',
        left: expr,
        operator,
        right,
        location: this.getLocation()
      };
    }
    
    return expr;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.Not, TokenType.Minus)) {
      const operator = this.previous().value as any;
      const right = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator,
        operand: right,
        location: this.getLocation()
      };
    }
    
    return this.parseCall();
  }

  private parseCall(): Expression {
    let expr = this.parsePrimary();
    
    while (true) {
      if (this.match(TokenType.LeftParen)) {
        const args: Expression[] = [];
        if (!this.check(TokenType.RightParen)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.RightParen, "Expected ')' after arguments");
        
        expr = {
          type: 'CallExpression',
          callee: expr,
          arguments: args,
          location: this.getLocation()
        };
      } else if (this.match(TokenType.Dot)) {
        const name = this.consume(TokenType.IDENTIFIER, "Expected property name").value;
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: { type: 'Identifier', name, location: this.getLocation() },
          location: this.getLocation()
        };
      } else {
        break;
      }
    }
    
    return expr;
  }

  private parsePrimary(): Expression {
    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: 'BooleanLiteral',
        value: this.previous().value === 'true',
        location: this.getLocation()
      };
    }
    
    if (this.match(TokenType.INTEGER)) {
      return {
        type: 'IntegerLiteral',
        value: BigInt(this.previous().value),
        location: this.getLocation()
      };
    }
    
    if (this.match(TokenType.LeftParen)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RightParen, "Expected ')' after expression");
      return expr;
    }
    
    throw new ParseError("Expected expression", this.peek());
  }

  private parseBlock(): Statement[] {
    this.consume(TokenType.LeftBrace, "Expected '{'");
    
    const statements: Statement[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Newline)) {
        this.advance();
        continue;
      }
      
      statements.push(this.parseStatement());
    }
    
    this.consume(TokenType.RightBrace, "Expected '}'");
    
    return statements;
  }

  private parseStatement(): Statement {
    if (this.match(TokenType.LET)) {
      return this.parseVariableDeclaration();
    }
    
    if (this.match(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    
    // Expression statement
    const expr = this.parseExpression();
    this.consume(TokenType.Semicolon, "Expected ';' after expression");
    return {
      type: 'ExpressionStatement',
      expression: expr,
      location: this.getLocation()
    };
  }

  private parseVariableDeclaration(): Statement {
    const name = this.parseIdentifier();
    
    let typeAnnotation: Type | undefined = undefined;
    if (this.match(TokenType.Colon)) {
      typeAnnotation = this.parseType();
    }
    
    let initializer: Expression | undefined = undefined;
    if (this.match(TokenType.Equal)) {
      initializer = this.parseExpression();
    }
    
    this.consume(TokenType.Semicolon, "Expected ';' after variable declaration");
    
    return {
      type: 'VariableDeclaration',
      name,
      typeAnnotation,
      initializer,
      mutable: false,
      location: this.getLocation()
    };
  }

  private parseReturnStatement(): Statement {
    let value: Expression | undefined = undefined;
    if (!this.check(TokenType.Semicolon)) {
      value = this.parseExpression();
    }
    
    this.consume(TokenType.Semicolon, "Expected ';' after return statement");
    
    return {
      type: 'ReturnStatement',
      value,
      location: this.getLocation()
    };
  }

  private parseIdentifier(): Identifier {
    const token = this.consume(TokenType.IDENTIFIER, "Expected identifier");
    return {
      type: 'Identifier',
      name: token.value,
      location: this.getLocation()
    };
  }

  private getLocation(): SourceLocation {
    const token = this.previous();
    return {
      line: token.line || 1,
      column: token.column || 1
    };
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.Semicolon) return;

      switch (this.peek().type) {
        case TokenType.CONTRACT:
        case TokenType.FN:
        case TokenType.STRUCT:
        case TokenType.ENUM:
        case TokenType.TRAIT:
        case TokenType.IMPL:
        case TokenType.USE:
        case TokenType.CONST:
        case TokenType.LET:
        case TokenType.RETURN:
          return;
      }

      this.advance();
    }
  }

  // Utility methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParseError(message, this.peek());
  }
}
