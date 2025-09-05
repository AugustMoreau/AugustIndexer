// Lexical analyzer for Augustium DSL

export enum TokenType {
  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  BOOLEAN = 'BOOLEAN',
  ADDRESS_LITERAL = 'ADDRESS_LITERAL',
  
  // Core Augustium Keywords
  CONTRACT = 'CONTRACT',
  CONSTRUCTOR = 'CONSTRUCTOR',
  FN = 'FN',
  LET = 'LET',
  MUT = 'MUT',
  CONST = 'CONST',
  IF = 'IF',
  ELSE = 'ELSE',
  WHILE = 'WHILE',
  FOR = 'FOR',
  IN = 'IN',
  RETURN = 'RETURN',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  MATCH = 'MATCH',
  ENUM = 'ENUM',
  STRUCT = 'STRUCT',
  TRAIT = 'TRAIT',
  IMPL = 'IMPL',
  MOD = 'MOD',
  USE = 'USE',
  PUB = 'PUB',
  PRIV = 'PRIV',
  EVENT = 'EVENT',
  EMIT = 'EMIT',
  REQUIRE = 'REQUIRE',
  ASSERT = 'ASSERT',
  REVERT = 'REVERT',
  AS = 'AS',
  INDEXED = 'INDEXED',
  
  // Indexer-specific Keywords
  INDEX = 'INDEX',
  QUERY = 'QUERY',
  FROM = 'FROM',
  WHERE = 'WHERE',
  ORDER_BY = 'ORDER_BY',
  LIMIT = 'LIMIT',
  
  // Indexer additional keywords
  SOURCE = 'SOURCE',
  MAP = 'MAP',
  EVENTS = 'EVENTS',
  ASC = 'ASC',
  DESC = 'DESC',
  
  // Chain identifiers
  ETHEREUM = 'ETHEREUM',
  SOLANA = 'SOLANA',
  AUGUSTIUM = 'AUGUSTIUM',
  MAINNET = 'MAINNET',
  TESTNET = 'TESTNET',
  
  // Primitive types
  U8 = 'U8',
  U16 = 'U16',
  U32 = 'U32',
  U64 = 'U64',
  U128 = 'U128',
  U256 = 'U256',
  I8 = 'I8',
  I16 = 'I16',
  I32 = 'I32',
  I64 = 'I64',
  I128 = 'I128',
  I256 = 'I256',
  BOOL = 'BOOL',
  STRING_TYPE = 'STRING_TYPE',
  ADDRESS = 'ADDRESS',
  BYTES = 'BYTES',
  
  // Machine Learning keywords
  MLModel = 'ML_MODEL',
  MLTrain = 'ML_TRAIN',
  MLPredict = 'ML_PREDICT',
  MLForward = 'ML_FORWARD',
  MLBackward = 'ML_BACKWARD',
  Tensor = 'TENSOR',
  Matrix = 'MATRIX',
  Vector = 'VECTOR',
  Metrics = 'METRICS',
  
  // Advanced ML keywords
  MLConv2D = 'ML_CONV2D',
  MLAttention = 'ML_ATTENTION',
  MLClone = 'ML_CLONE',
  MLQuantize = 'ML_QUANTIZE',
  MLEvaluate = 'ML_EVALUATE',
  MLExport = 'ML_EXPORT',
  MLSync = 'ML_SYNC',
  MLAugment = 'ML_AUGMENT',
  MLLoadDataset = 'ML_LOAD_DATASET',
  MLConfusionMatrix = 'ML_CONFUSION_MATRIX',
  
  // Tensor creation helpers
  CreateTensor = 'CREATE_TENSOR',
  CreateVector = 'CREATE_VECTOR',
  CreateMatrix = 'CREATE_MATRIX',
  // Operators
  Plus = 'PLUS',           // +
  Minus = 'MINUS',         // -
  Star = 'STAR',           // *
  Slash = 'SLASH',         // /
  Percent = 'PERCENT',     // %
  Equal = 'EQUAL',         // =
  EqualEqual = 'EQUAL_EQUAL',     // ==
  NotEqual = 'NOT_EQUAL',         // !=
  Less = 'LESS',                  // <
  LessEqual = 'LESS_EQUAL',       // <=
  Greater = 'GREATER',            // >
  GreaterEqual = 'GREATER_EQUAL', // >=
  And = 'AND',                    // &&
  Or = 'OR',                      // ||
  Not = 'NOT',                    // !
  BitAnd = 'BIT_AND',             // &
  BitOr = 'BIT_OR',               // |
  BitXor = 'BIT_XOR',             // ^
  BitNot = 'BIT_NOT',             // ~
  LeftShift = 'LEFT_SHIFT',       // <<
  RightShift = 'RIGHT_SHIFT',     // >>
  PlusEqual = 'PLUS_EQUAL',       // +=
  MinusEqual = 'MINUS_EQUAL',     // -=
  StarEqual = 'STAR_EQUAL',       // *=
  SlashEqual = 'SLASH_EQUAL',     // /=

  // Punctuation
  LeftParen = 'LEFT_PAREN',       // (
  RightParen = 'RIGHT_PAREN',     // )
  LeftBrace = 'LEFT_BRACE',       // {
  RightBrace = 'RIGHT_BRACE',     // }
  LeftBracket = 'LEFT_BRACKET',   // [
  RightBracket = 'RIGHT_BRACKET', // ]
  Semicolon = 'SEMICOLON',        // ;
  Comma = 'COMMA',                // ,
  Dot = 'DOT',                    // .
  Colon = 'COLON',                // :
  DoubleColon = 'DOUBLE_COLON',   // ::
  Arrow = 'ARROW',                // ->
  FatArrow = 'FAT_ARROW',         // =>
  Question = 'QUESTION',          // ?
  At = 'AT',                      // @
  Hash = 'HASH',                  // #
  Dollar = 'DOLLAR',              // $
  Underscore = 'UNDERSCORE',      // _

  // Special tokens
  Newline = 'NEWLINE',
  EOF = 'EOF',

  // Comments (usually filtered out)
  LineComment = 'LINE_COMMENT',
  BlockComment = 'BLOCK_COMMENT'
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  
  private keywords: Map<string, TokenType> = new Map([
    // Core keywords
    ['contract', TokenType.CONTRACT],
    ['constructor', TokenType.CONSTRUCTOR],
    ['fn', TokenType.FN],
    ['let', TokenType.LET],
    ['mut', TokenType.MUT],
    ['const', TokenType.CONST],
    ['if', TokenType.IF],
    ['else', TokenType.ELSE],
    ['while', TokenType.WHILE],
    ['for', TokenType.FOR],
    ['in', TokenType.IN],
    ['return', TokenType.RETURN],
    ['break', TokenType.BREAK],
    ['continue', TokenType.CONTINUE],
    ['match', TokenType.MATCH],
    ['enum', TokenType.ENUM],
    ['struct', TokenType.STRUCT],
    ['trait', TokenType.TRAIT],
    ['impl', TokenType.IMPL],
    ['mod', TokenType.MOD],
    ['use', TokenType.USE],
    ['pub', TokenType.PUB],
    ['priv', TokenType.PRIV],
    ['event', TokenType.EVENT],
    ['emit', TokenType.EMIT],
    ['require', TokenType.REQUIRE],
    ['assert', TokenType.ASSERT],
    ['revert', TokenType.REVERT],
    ['as', TokenType.AS],
    ['indexed', TokenType.INDEXED],

    // ML keywords
    ['ml_model', TokenType.MLModel],
    ['ml_train', TokenType.MLTrain],
    ['ml_predict', TokenType.MLPredict],
    ['ml_forward', TokenType.MLForward],
    ['ml_backward', TokenType.MLBackward],
    ['tensor', TokenType.Tensor],
    ['matrix', TokenType.Matrix],
    ['vector', TokenType.Vector],
    ['metrics', TokenType.Metrics],

    // Advanced ML keywords
    ['ml_conv2d', TokenType.MLConv2D],
    ['ml_attention', TokenType.MLAttention],
    ['ml_clone', TokenType.MLClone],
    ['ml_quantize', TokenType.MLQuantize],
    ['ml_evaluate', TokenType.MLEvaluate],
    ['ml_export', TokenType.MLExport],
    ['ml_sync', TokenType.MLSync],
    ['ml_augment', TokenType.MLAugment],
    ['ml_load_dataset', TokenType.MLLoadDataset],
    ['ml_confusion_matrix', TokenType.MLConfusionMatrix],

    // Tensor creation functions
    ['create_tensor', TokenType.CreateTensor],
    ['create_vector', TokenType.CreateVector],
    ['create_matrix', TokenType.CreateMatrix],

    // Type keywords
    // Indexer-specific keywords
    ['index', TokenType.INDEX],
    ['query', TokenType.QUERY],
    ['from', TokenType.FROM],
    ['where', TokenType.WHERE],
    ['order_by', TokenType.ORDER_BY],
    ['limit', TokenType.LIMIT],
    ['source', TokenType.SOURCE],
    ['map', TokenType.MAP],
    ['events', TokenType.EVENTS],
    ['asc', TokenType.ASC],
    ['desc', TokenType.DESC],
    
    // Chain identifiers
    ['Ethereum', TokenType.ETHEREUM],
    ['Solana', TokenType.SOLANA],
    ['Augustium', TokenType.AUGUSTIUM],
    ['Mainnet', TokenType.MAINNET],
    ['Testnet', TokenType.TESTNET],
    
    // Types (matching Augustium reference)
    ['u8', TokenType.U8],
    ['u16', TokenType.U16],
    ['u32', TokenType.U32],
    ['u64', TokenType.U64],
    ['u128', TokenType.U128],
    ['u256', TokenType.U256],
    ['i8', TokenType.I8],
    ['i16', TokenType.I16],
    ['i32', TokenType.I32],
    ['i64', TokenType.I64],
    ['i128', TokenType.I128],
    ['i256', TokenType.I256],
    ['bool', TokenType.BOOL],
    ['String', TokenType.STRING_TYPE],
    ['Address', TokenType.ADDRESS],
    ['Bytes', TokenType.BYTES],
    ['true', TokenType.BOOLEAN],
    ['false', TokenType.BOOLEAN],
  ]);

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (!this.isAtEnd()) {
      const token = this.nextToken();
      if (token && token.type !== TokenType.Newline && token.type !== TokenType.LineComment && token.type !== TokenType.BlockComment) {
        tokens.push(token);
      }
    }
    
    tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
      start: this.position,
      end: this.position,
    });
    
    return tokens;
  }

  private nextToken(): Token | null {
    this.skipWhitespace();
    
    if (this.isAtEnd()) return null;
    
    const start = this.position;
    const line = this.line;
    const column = this.column;
    
    const char = this.peek();
    
    // Comments
    if (char === '/' && this.peekNext() === '/') {
      return this.readComment(start, line, column);
    }
    
    // String literals
    if (char === '"' || char === "'") {
      return this.readString(start, line, column);
    }
    
    // Numbers
    if (this.isDigit(char)) {
      return this.readNumber(start, line, column);
    }
    
    // Address literals (0x...)
    if (char === '0' && this.peekNext() === 'x') {
      return this.readAddressLiteral(start, line, column);
    }
    
    // Identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      return this.readIdentifier(start, line, column);
    }
    
    // Two-character operators
    if (char === '=' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return this.makeToken(TokenType.EqualEqual, '==', start, line, column);
    }
    
    if (char === '!' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return this.makeToken(TokenType.NotEqual, '!=', start, line, column);
    }
    
    if (char === '>' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return this.makeToken(TokenType.GreaterEqual, '>=', start, line, column);
    }
    
    if (char === '<' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return this.makeToken(TokenType.LessEqual, '<=', start, line, column);
    }
    
    if (char === '=' && this.peekNext() === '>') {
      this.advance();
      this.advance();
      return this.makeToken(TokenType.FatArrow, '=>', start, line, column);
    }
    
    // Single-character tokens
    const singleChar = this.advance();
    switch (singleChar) {
      case '{': return this.makeToken(TokenType.LeftBrace, singleChar, start, line, column);
      case '}': return this.makeToken(TokenType.RightBrace, singleChar, start, line, column);
      case '(': return this.makeToken(TokenType.LeftParen, singleChar, start, line, column);
      case ')': return this.makeToken(TokenType.RightParen, singleChar, start, line, column);
      case '[': return this.makeToken(TokenType.LeftBracket, singleChar, start, line, column);
      case ']': return this.makeToken(TokenType.RightBracket, singleChar, start, line, column);
      case ',': return this.makeToken(TokenType.Comma, singleChar, start, line, column);
      case ':': return this.makeToken(TokenType.Colon, singleChar, start, line, column);
      case ';': return this.makeToken(TokenType.Semicolon, singleChar, start, line, column);
      case '.': return this.makeToken(TokenType.Dot, singleChar, start, line, column);
      case '=': return this.makeToken(TokenType.Equal, singleChar, start, line, column);
      case '>': return this.makeToken(TokenType.Greater, singleChar, start, line, column);
      case '<': return this.makeToken(TokenType.Less, singleChar, start, line, column);
      case '\n':
        this.line++;
        this.column = 1;
        return this.makeToken(TokenType.Newline, singleChar, start, line, column);
      default:
        throw new Error(`Unexpected character '${singleChar}' at line ${line}, column ${column}`);
    }
  }

  private readComment(start: number, line: number, column: number): Token {
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    return this.makeToken(TokenType.LineComment, value, start, line, column);
  }

  private readString(start: number, line: number, column: number): Token {
    const quote = this.advance(); // consume opening quote
    
    while (this.peek() !== quote && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      if (this.peek() === '\\') {
        this.advance(); // consume escape character
      }
      this.advance();
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${line}, column ${column}`);
    }
    
    this.advance(); // consume closing quote
    
    const value = this.input.substring(start + 1, this.position - 1); // exclude quotes
    return this.makeToken(TokenType.STRING, value, start, line, column);
  }

  private readNumber(start: number, line: number, column: number): Token {
    while (this.isDigit(this.peek())) {
      this.advance();
    }
    
    // Handle decimal numbers
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }
      const value = this.input.substring(start, this.position);
      return this.makeToken(TokenType.FLOAT, value, start, line, column);
    }
    
    const value = this.input.substring(start, this.position);
    return this.makeToken(TokenType.INTEGER, value, start, line, column);
  }
  
  private readAddressLiteral(start: number, line: number, column: number): Token {
    this.advance(); // consume '0'
    this.advance(); // consume 'x'
    
    while (this.isHexDigit(this.peek())) {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    return this.makeToken(TokenType.ADDRESS_LITERAL, value, start, line, column);
  }

  private readIdentifier(start: number, line: number, column: number): Token {
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    const tokenType = this.keywords.get(value) || TokenType.IDENTIFIER;
    
    return this.makeToken(tokenType, value, start, line, column);
  }

  private skipWhitespace(): void {
    while (true) {
      const char = this.peek();
      if (char === ' ' || char === '\r' || char === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private makeToken(type: TokenType, value: string, start: number, line: number, column: number): Token {
    return {
      type,
      value,
      line,
      column,
      start,
      end: this.position,
    };
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input[this.position + 1];
  }

  private advance(): string {
    if (this.isAtEnd()) return '\0';
    const char = this.input[this.position];
    this.position++;
    this.column++;
    return char;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || 
           (char >= 'A' && char <= 'Z') || 
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
  
  private isHexDigit(char: string): boolean {
    return this.isDigit(char) || 
           (char >= 'a' && char <= 'f') || 
           (char >= 'A' && char <= 'F');
  }
}
