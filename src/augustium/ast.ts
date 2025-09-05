// Abstract Syntax Tree definitions for Augustium Programming Language
// Based on official Augustium specification

export interface ASTNode {
  type: string;
  location?: SourceLocation;
}

export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

// Top-level source file
export interface SourceFile extends ASTNode {
  type: 'SourceFile';
  items: Item[];
  location: SourceLocation;
}

// Top-level items in an Augustium source file
export type Item = 
  | Contract
  | Function
  | Struct
  | Enum
  | Trait
  | Impl
  | UseDeclaration
  | ConstDeclaration
  | Module
  | OperatorImpl;

// Contract definition
export interface Contract extends ASTNode {
  type: 'Contract';
  name: Identifier;
  fields: Field[];
  functions: Function[];
  events: Event[];
  modifiers: Modifier[];
  location: SourceLocation;
}

// Function definition
export interface Function extends ASTNode {
  type: 'Function';
  name: Identifier;
  typeParameters: TypeParameter[];
  parameters: Parameter[];
  returnType?: Type;
  body: Block;
  visibility: Visibility;
  mutability: Mutability;
  attributes: Attribute[];
  isAsync: boolean;
  location: SourceLocation;
}

// Struct definition
export interface Struct extends ASTNode {
  type: 'Struct';
  name: Identifier;
  typeParameters: TypeParameter[];
  fields: Field[];
  visibility: Visibility;
  location: SourceLocation;
}

// Enum definition
export interface Enum extends ASTNode {
  type: 'Enum';
  name: Identifier;
  variants: EnumVariant[];
  visibility: Visibility;
  location: SourceLocation;
}

export interface EnumVariant extends ASTNode {
  type: 'EnumVariant';
  name: Identifier;
  fields?: Type[];
  location: SourceLocation;
}

// Trait definition
export interface Trait extends ASTNode {
  type: 'Trait';
  name: Identifier;
  typeParameters: TypeParameter[];
  functions: TraitFunction[];
  associatedTypes: AssociatedType[];
  visibility: Visibility;
  location: SourceLocation;
}

export interface TraitFunction extends ASTNode {
  type: 'TraitFunction';
  name: Identifier;
  parameters: Parameter[];
  returnType?: Type;
  location: SourceLocation;
}

export interface AssociatedType extends ASTNode {
  type: 'AssociatedType';
  name: Identifier;
  bounds?: Type[];
  location: SourceLocation;
}

// Implementation block
export interface Impl extends ASTNode {
  type: 'Impl';
  traitName?: Identifier;
  typeName: Identifier;
  typeParameters: TypeParameter[];
  whereClause?: WhereClause;
  functions: Function[];
  location: SourceLocation;
}

// Use declaration
export interface UseDeclaration extends ASTNode {
  type: 'UseDeclaration';
  path: Identifier[];
  alias?: Identifier;
  location: SourceLocation;
}

// Constant declaration
export interface ConstDeclaration extends ASTNode {
  type: 'ConstDeclaration';
  name: Identifier;
  typeAnnotation: Type;
  value: Expression;
  visibility: Visibility;
  location: SourceLocation;
}

// Module declaration
export interface Module extends ASTNode {
  type: 'Module';
  name: Identifier;
  items: Item[];
  visibility: Visibility;
  location: SourceLocation;
}

// Operator implementation
export interface OperatorImpl extends ASTNode {
  type: 'OperatorImpl';
  operator: string;
  leftType: Type;
  rightType?: Type;
  returnType: Type;
  body: Block;
  location: SourceLocation;
}

// Event definition
export interface Event extends ASTNode {
  type: 'Event';
  name: Identifier;
  fields: EventField[];
  location: SourceLocation;
}

export interface EventField extends ASTNode {
  type: 'EventField';
  name: Identifier;
  typeAnnotation: Type;
  indexed: boolean;
  location: SourceLocation;
}

// Function modifier
export interface Modifier extends ASTNode {
  type: 'Modifier';
  name: Identifier;
  parameters: Parameter[];
  body: Block;
  location: SourceLocation;
}

// Struct or contract field
export interface Field extends ASTNode {
  type: 'Field';
  name: Identifier;
  typeAnnotation: Type;
  visibility: Visibility;
  location: SourceLocation;
}

// Function parameter
export interface Parameter extends ASTNode {
  type: 'Parameter';
  name: Identifier;
  typeAnnotation: Type;
  location: SourceLocation;
}

// Type parameter (generics)
export interface TypeParameter extends ASTNode {
  type: 'TypeParameter';
  name: Identifier;
  bounds?: Type[];
  location: SourceLocation;
}

// Where clause for generics
export interface WhereClause extends ASTNode {
  type: 'WhereClause';
  predicates: WherePredicate[];
  location: SourceLocation;
}

export interface WherePredicate extends ASTNode {
  type: 'WherePredicate';
  boundType: Type;
  bounds: Type[];
  location: SourceLocation;
}

// Attributes
export interface Attribute extends ASTNode {
  type: 'Attribute';
  name: string;
  arguments?: Expression[];
  location: SourceLocation;
}

// Block of statements
export interface Block extends ASTNode {
  type: 'Block';
  statements: Statement[];
  location: SourceLocation;
}

// Statements
export type Statement = 
  | ExpressionStatement
  | VariableDeclaration
  | AssignmentStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | MatchStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | EmitStatement;

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
  location: SourceLocation;
}

export interface VariableDeclaration extends ASTNode {
  type: 'VariableDeclaration';
  name: Identifier;
  typeAnnotation?: Type;
  initializer?: Expression;
  mutable: boolean;
  location: SourceLocation;
}

export interface AssignmentStatement extends ASTNode {
  type: 'AssignmentStatement';
  left: Expression;
  operator: AssignmentOperator;
  right: Expression;
  location: SourceLocation;
}

export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  condition: Expression;
  thenBranch: Block;
  elseBranch?: Block;
  location: SourceLocation;
}

export interface WhileStatement extends ASTNode {
  type: 'WhileStatement';
  condition: Expression;
  body: Block;
  location: SourceLocation;
}

export interface ForStatement extends ASTNode {
  type: 'ForStatement';
  variable: Identifier;
  iterable: Expression;
  body: Block;
  location: SourceLocation;
}

export interface MatchStatement extends ASTNode {
  type: 'MatchStatement';
  expression: Expression;
  arms: MatchArm[];
  location: SourceLocation;
}

export interface MatchArm extends ASTNode {
  type: 'MatchArm';
  pattern: Pattern;
  guard?: Expression;
  body: Block;
  location: SourceLocation;
}

export interface ReturnStatement extends ASTNode {
  type: 'ReturnStatement';
  value?: Expression;
  location: SourceLocation;
}

export interface BreakStatement extends ASTNode {
  type: 'BreakStatement';
  location: SourceLocation;
}

export interface ContinueStatement extends ASTNode {
  type: 'ContinueStatement';
  location: SourceLocation;
}

export interface EmitStatement extends ASTNode {
  type: 'EmitStatement';
  event: Identifier;
  arguments: Expression[];
  location: SourceLocation;
}

// Expressions
export type Expression = 
  | Identifier
  | Literal
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | ArrayExpression
  | ObjectExpression
  | TensorExpression
  | MLExpression
  | CastExpression
  | AwaitExpression;

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
  location: SourceLocation;
}

export type Literal = 
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | BooleanLiteral
  | AddressLiteral;

export interface IntegerLiteral extends ASTNode {
  type: 'IntegerLiteral';
  value: bigint;
  location: SourceLocation;
}

export interface FloatLiteral extends ASTNode {
  type: 'FloatLiteral';
  value: number;
  location: SourceLocation;
}

export interface StringLiteral extends ASTNode {
  type: 'StringLiteral';
  value: string;
  location: SourceLocation;
}

export interface BooleanLiteral extends ASTNode {
  type: 'BooleanLiteral';
  value: boolean;
  location: SourceLocation;
}

export interface AddressLiteral extends ASTNode {
  type: 'AddressLiteral';
  value: string;
  location: SourceLocation;
}

export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  left: Expression;
  operator: BinaryOperator;
  right: Expression;
  location: SourceLocation;
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  operand: Expression;
  location: SourceLocation;
}

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
  location: SourceLocation;
}

export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
  location: SourceLocation;
}

export interface IndexExpression extends ASTNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
  location: SourceLocation;
}

export interface ArrayExpression extends ASTNode {
  type: 'ArrayExpression';
  elements: Expression[];
  location: SourceLocation;
}

export interface ObjectExpression extends ASTNode {
  type: 'ObjectExpression';
  properties: ObjectProperty[];
  location: SourceLocation;
}

export interface ObjectProperty extends ASTNode {
  type: 'ObjectProperty';
  key: Identifier;
  value: Expression;
  location: SourceLocation;
}

// ML-specific expressions
export interface TensorExpression extends ASTNode {
  type: 'TensorExpression';
  dimensions: Expression[];
  data?: Expression[];
  location: SourceLocation;
}

export interface MLExpression extends ASTNode {
  type: 'MLExpression';
  operation: MLOperation;
  arguments: Expression[];
  location: SourceLocation;
}

export interface CastExpression extends ASTNode {
  type: 'CastExpression';
  expression: Expression;
  targetType: Type;
  location: SourceLocation;
}

export interface AwaitExpression extends ASTNode {
  type: 'AwaitExpression';
  expression: Expression;
  location: SourceLocation;
}

// Patterns for match statements
export type Pattern = 
  | IdentifierPattern
  | LiteralPattern
  | StructPattern
  | EnumPattern
  | WildcardPattern;

export interface IdentifierPattern extends ASTNode {
  type: 'IdentifierPattern';
  name: Identifier;
  location: SourceLocation;
}

export interface LiteralPattern extends ASTNode {
  type: 'LiteralPattern';
  literal: Literal;
  location: SourceLocation;
}

export interface StructPattern extends ASTNode {
  type: 'StructPattern';
  name: Identifier;
  fields: PatternField[];
  location: SourceLocation;
}

export interface PatternField extends ASTNode {
  type: 'PatternField';
  name: Identifier;
  pattern: Pattern;
  location: SourceLocation;
}

export interface EnumPattern extends ASTNode {
  type: 'EnumPattern';
  name: Identifier;
  variant: Identifier;
  fields?: Pattern[];
  location: SourceLocation;
}

export interface WildcardPattern extends ASTNode {
  type: 'WildcardPattern';
  location: SourceLocation;
}

// Types
export type Type = 
  | PrimitiveType
  | ArrayType
  | TupleType
  | FunctionType
  | GenericType
  | ReferenceType;

export interface PrimitiveType extends ASTNode {
  type: 'PrimitiveType';
  name: PrimitiveTypeName;
  location: SourceLocation;
}

export interface ArrayType extends ASTNode {
  type: 'ArrayType';
  elementType: Type;
  size?: Expression;
  location: SourceLocation;
}

export interface TupleType extends ASTNode {
  type: 'TupleType';
  elements: Type[];
  location: SourceLocation;
}

export interface FunctionType extends ASTNode {
  type: 'FunctionType';
  parameters: Type[];
  returnType: Type;
  location: SourceLocation;
}

export interface GenericType extends ASTNode {
  type: 'GenericType';
  name: Identifier;
  typeArguments: Type[];
  location: SourceLocation;
}

export interface ReferenceType extends ASTNode {
  type: 'ReferenceType';
  referent: Type;
  mutable: boolean;
  location: SourceLocation;
}

// Enums for various language constructs
export type Visibility = 'public' | 'private';
export type Mutability = 'mutable' | 'immutable';
export type PrimitiveTypeName = 
  | 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256'
  | 'i8' | 'i16' | 'i32' | 'i64' | 'i128' | 'i256'
  | 'bool' | 'String' | 'Address' | 'Bytes';

export type BinaryOperator = 
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||' | '&' | '|' | '^' | '<<' | '>>';

export type UnaryOperator = '+' | '-' | '!' | '~';
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=';

export type MLOperation = 
  | 'ml_model' | 'ml_train' | 'ml_predict' | 'ml_forward' | 'ml_backward'
  | 'ml_conv2d' | 'ml_attention' | 'ml_quantize' | 'ml_evaluate'
  | 'create_tensor' | 'create_vector' | 'create_matrix';

// Visitor pattern for AST traversal
export interface Visitor<T = void> {
  visitSourceFile?(node: SourceFile): T;
  visitContract?(node: Contract): T;
  visitFunction?(node: Function): T;
  visitStruct?(node: Struct): T;
  visitEnum?(node: Enum): T;
  visitTrait?(node: Trait): T;
  visitImpl?(node: Impl): T;
  visitUseDeclaration?(node: UseDeclaration): T;
  visitConstDeclaration?(node: ConstDeclaration): T;
  visitModule?(node: Module): T;
  visitBlock?(node: Block): T;
  visitExpression?(node: Expression): T;
  visitStatement?(node: Statement): T;
  visitType?(node: Type): T;
  visitPattern?(node: Pattern): T;
}

export function traverse<T>(node: ASTNode, visitor: Visitor<T>): T | undefined {
  const method = `visit${node.type}` as keyof Visitor<T>;
  const visitMethod = visitor[method];
  
  if (visitMethod && typeof visitMethod === 'function') {
    return (visitMethod as any).call(visitor, node);
  }
  
  return undefined;
}
