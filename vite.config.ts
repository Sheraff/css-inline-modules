import { PluginOption, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TSESTree } from "@typescript-eslint/types"
import { visitorKeys } from '@typescript-eslint/visitor-keys'
import MagicString from 'magic-string'
import { createHash } from 'node:crypto'

const SKIP = Symbol('skip')

declare module '@typescript-eslint/types' {
  export namespace TSESTree {
    interface BaseNode {
      start: number
      end: number
      [SKIP]?: boolean
    }
  }
}


const importName = '__GENERATED_CLASSES_OBJECT__'

function CssExtract(): PluginOption {
  const virtualCssFiles = new Map<string, string>()
  return {
    name: "css-extract",
    resolveId(source, importer, options) {
      if (virtualCssFiles.has(source)) {
        return source
      }
    },
    load(id, options) {
      if (virtualCssFiles.has(id)) {
        const code = virtualCssFiles.get(id)
        return code
      }
    },
    transform: {
      handler(code, id, options) {
        if (!id.endsWith(".tsx")) return { code, ast: null, map: null }
        const ast = this.parse(code) as TSESTree.Program & TSESTree.BaseNode
        const jsParts: Array<{ type: "global", start: number, end: number } | { type: "dynamic", start: number, end: number, id: string }> = []
        const cssParts: Array<{ type: "take", start: number, end: number } | { type: "add", content: string }> = []
        let add = 0
        walkAst(ast, {
          '*'(node) {
            node.start += add
          },
          '*:exit'(node) {
            node.end += add
          },
          TaggedTemplateExpression(node) {
            if (node.tag.type !== "Identifier") return
            if (node.tag.name === "css") {
              const quasi = node.quasi
              if (quasi.type !== "TemplateLiteral") return
              const { quasis: [quasiNode] } = quasi
              jsParts.push({ type: "global", start: node.start - add, end: node.end })
              cssParts.push({ type: "take", start: quasiNode.start, end: quasiNode.end })
              const length = node.end - (node.start - add)
              makeGlobalNode(node)
              add += node.end - node.start - length
              return
            }
            if (node.tag.name === "inline") {
              const quasi = node.quasi
              if (quasi.type !== "TemplateLiteral") return
              const { quasis: [quasiNode] } = quasi
              const value = quasiNode.value.raw
              const id = '_' + createHash('sha1').update(value.replace(/\s+/g, ' ')).digest('base64').replace(/\+/g, "_").replace(/\//g, "_").replace(/=/g, "")
              jsParts.push({ type: "dynamic", start: node.start - add, end: node.end, id })
              cssParts.push({ type: "add", content: `\n.${id}{\n` })
              cssParts.push({ type: "take", start: quasiNode.start, end: quasiNode.end })
              cssParts.push({ type: "add", content: `\n}\n` })
              const length = node.end - (node.start - add)
              makeDynamicNode(node, id)
              add += node.end - node.start - length
              return
            }
          },
          CallExpression(node) {
            if (node.callee.type !== "Identifier") return
            if (node.callee.name === "css") {
              const cssNode = node.arguments[0]
              if (cssNode.type === "Literal") {
                jsParts.push({ type: "global", start: node.start - add, end: node.end })
                cssParts.push({ type: "take", start: cssNode.start, end: cssNode.end })
              } else if (cssNode.type === "TemplateLiteral") {
                const { quasis: [quasiNode] } = cssNode
                jsParts.push({ type: "global", start: node.start - add, end: node.end })
                cssParts.push({ type: "take", start: quasiNode.start, end: quasiNode.end })
              } else { return }
              const length = node.end - (node.start - add)
              makeGlobalNode(node)
              add += node.end - node.start - length
              return
            }
            if (node.callee.name === "inline") {
              const cssNode = node.arguments[0]
              if (cssNode.type === "Literal") {
                const value = cssNode.value
                if (typeof value !== "string") return
                const id = '_' + createHash('sha1').update(value.replace(/\s+/g, ' ')).digest('base64').replace(/\+/g, "_").replace(/\//g, "_").replace(/=/g, "")
                jsParts.push({ type: "dynamic", start: node.start - add, end: node.end, id })
                cssParts.push({ type: "add", content: `\n.${id}{\n` })
                cssParts.push({ type: "take", start: cssNode.start, end: cssNode.end })
                cssParts.push({ type: "add", content: `\n}\n` })
              } else if (cssNode.type === "TemplateLiteral") {
                const { quasis: [quasiNode] } = cssNode
                const value = quasiNode.value.raw
                const id = '_' + createHash('sha1').update(value.replace(/\s+/g, ' ')).digest('base64').replace(/\+/g, "_").replace(/\//g, "_").replace(/=/g, "")
                jsParts.push({ type: "dynamic", start: node.start - add, end: node.end, id })
                cssParts.push({ type: "add", content: `\n.${id}{\n` })
                cssParts.push({ type: "take", start: quasiNode.start, end: quasiNode.end })
                cssParts.push({ type: "add", content: `\n}\n` })
              } else { return }
              const length = node.end - (node.start - add)
              makeDynamicNode(node, id)
              add += node.end - node.start - length
              return
            }
          }
        })

        if (cssParts.length === 0) return { code, ast, map: null }

        // if Vite supported sourcemap for css, we could generate the cssString with MagicString here instead
        let cssString = ""
        for (const part of cssParts) {
          if (part.type === "add") {
            cssString += part.content
            continue
          }
          if (part.type === "take") {
            cssString += code.slice(part.start, part.end)
            continue
          }
        }
        cssString = cssString.replace(/\n+/g, "\n")
        const cssFileName = createHash('sha1').update(cssString).digest('base64') + '.module.css'
        virtualCssFiles.set(cssFileName, cssString)

        const s = new MagicString(code)
        for (let i = jsParts.length - 1; i >= 0; i--) {
          const current = jsParts[i]
          if (current.type === "global") {
            const { start, end } = current
            s.update(start, end, importName)
            continue
          }
          if (current.type === "dynamic") {
            const { start, end, id } = current
            s.update(start, end, `${importName}.${id}`)
            continue
          }
        }

        const importStr = `\nimport ${importName} from '${cssFileName}';`
        s.append(importStr)
        const map = s.generateMap({ source: id })
        const transformed = s.toString()

        addImportSpecifierNode(ast, importStr, cssFileName)

        return {
          ast,
          code: transformed,
          map,
        }
      },
    }
  }
}

function makeGlobalNode(node: TSESTree.BaseNode) {
  const start = node.start
  const parent = node.parent
  Object.keys(node).forEach(key => delete node[key])
  const newNode: TSESTree.Identifier = {
    type: TSESTree.AST_NODE_TYPES.Identifier,
    name: importName,
    start: start,
    end: start + importName.length,
    parent: parent,
    decorators: null,
    typeAnnotation: null,
    optional: false,
    [SKIP]: true,
    loc: null,
    range: null,
  }
  Object.assign(node, newNode)
}

function makeDynamicNode(node: TSESTree.BaseNode, id: string) {
  const start = node.start
  const parent = node.parent
  Object.keys(node).forEach(key => delete node[key])
  const newNode: TSESTree.MemberExpression = {
    type: TSESTree.AST_NODE_TYPES.MemberExpression,
    object: null,
    property: null,
    computed: false,
    start: start,
    end: start + importName.length + 1 + id.length,
    parent: parent,
    optional: false,
    [SKIP]: true,
    loc: null,
    range: null,
  }
  const identifier: TSESTree.Identifier = {
    type: TSESTree.AST_NODE_TYPES.Identifier,
    name: importName,
    start: start,
    end: start + importName.length,
    decorators: null,
    typeAnnotation: null,
    optional: false,
    parent: newNode,
    loc: null,
    range: null,
  }
  newNode.object = identifier
  const property: TSESTree.Identifier = {
    type: TSESTree.AST_NODE_TYPES.Identifier,
    name: id,
    start: start + importName.length + 1,
    end: start + importName.length + 1 + id.length,
    decorators: null,
    typeAnnotation: null,
    optional: false,
    parent: newNode,
    loc: null,
    range: null,
  }
  newNode.property = property
  Object.assign(node, newNode)
}

function addImportSpecifierNode(ast: TSESTree.Program & TSESTree.BaseNode, importStr: string, cssFileName: string) {
  const end = ast.end + 1
  ast.end += importStr.length

  const declaration: TSESTree.ImportDeclaration = {
    type: TSESTree.AST_NODE_TYPES.ImportDeclaration,
    source: null,
    specifiers: [],
    start: end,
    end: end + importStr.length - 1,
    attributes: null,
    importKind: null,
    parent: ast,
    loc: null,
    range: null,
    assertions: null,
  }

  const source: TSESTree.Literal = {
    type: TSESTree.AST_NODE_TYPES.Literal,
    value: cssFileName,
    raw: `'${cssFileName}'`,
    start: end + 41,
    end: end + importStr.length - 2,
    parent: declaration,
    loc: null,
    range: null,
  }
  declaration.source = source

  const importSpecifier: TSESTree.ImportDefaultSpecifier = {
    type: TSESTree.AST_NODE_TYPES.ImportDefaultSpecifier,
    local: null,
    start: end + 7,
    end: end + 35,
    parent: declaration,
    loc: null,
    range: null,
  }
  declaration.specifiers.push(importSpecifier)

  const identifier: TSESTree.Identifier = {
    type: TSESTree.AST_NODE_TYPES.Identifier,
    name: importName,
    start: end + 7,
    end: end + 35,
    decorators: null,
    typeAnnotation: null,
    optional: false,
    parent: importSpecifier,
    loc: null,
    range: null,
  }
  importSpecifier.local = identifier

  ast.body.push(declaration)
}

type Listener = {
  [key in keyof AllNodes]?: (node: AllNodes[key]) => void
} & {
    [key in keyof AllNodes as `${key}:exit`]?: (node: AllNodes[key]) => void
  } & {
    '*'?: (node: TSESTree.BaseNode) => void
    '*:exit'?: (node: TSESTree.BaseNode) => void
  }

function walkAst(ast: TSESTree.BaseNode, listener: Listener) {

  const walker = <TNode extends TSESTree.BaseNode>(node: TNode) => {
    if ('*' in listener) {
      listener['*'](node)
    }
    if (node.type in listener) {
      listener[node.type](node)
    }
    if (node[SKIP]) {
      return
    }

    const keys = visitorKeys[node.type]?.concat('_rollupAnnotations') as ReadonlyArray<keyof TNode & string>
    if (keys) {
      for (const key of keys) {
        const child = node[key] as TSESTree.BaseNode | TSESTree.BaseNode[] | undefined
        if (!child) continue
        if (Array.isArray(child)) {
          for (const c of child) {
            walker(c)
          }
        } else if (child) {
          walker(child)
        }
      }
    }
    if (`${node.type}:exit` in listener) {
      listener[`${node.type}:exit`](node)
    }
    if ('*:exit' in listener) {
      listener['*:exit'](node)
    }
  }

  walker(ast)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [CssExtract(), react()],
  build: {
    sourcemap: true,
    cssMinify: "lightningcss"
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      cssModules: {
        dashedIdents: false,
      },
    }
  }
})




type AllNodes = {
  AccessorPropertyComputedName: TSESTree.AccessorPropertyComputedName,
  AccessorPropertyNonComputedName: TSESTree.AccessorPropertyNonComputedName,
  ArrayExpression: TSESTree.ArrayExpression,
  ArrayPattern: TSESTree.ArrayPattern,
  ArrowFunctionExpression: TSESTree.ArrowFunctionExpression,
  AssignmentExpression: TSESTree.AssignmentExpression,
  AssignmentOperatorToText: TSESTree.AssignmentOperatorToText,
  AssignmentPattern: TSESTree.AssignmentPattern,
  AwaitExpression: TSESTree.AwaitExpression,
  BaseNode: TSESTree.BaseNode,
  BigIntLiteral: TSESTree.BigIntLiteral,
  BinaryExpression: TSESTree.BinaryExpression,
  BinaryOperatorToText: TSESTree.BinaryOperatorToText,
  BlockComment: TSESTree.BlockComment,
  BlockStatement: TSESTree.BlockStatement,
  BooleanLiteral: TSESTree.BooleanLiteral,
  BooleanToken: TSESTree.BooleanToken,
  BreakStatement: TSESTree.BreakStatement,
  CallExpression: TSESTree.CallExpression,
  CatchClause: TSESTree.CatchClause,
  ChainExpression: TSESTree.ChainExpression,
  ClassBody: TSESTree.ClassBody,
  ClassDeclarationWithName: TSESTree.ClassDeclarationWithName,
  ClassDeclarationWithOptionalName: TSESTree.ClassDeclarationWithOptionalName,
  ClassExpression: TSESTree.ClassExpression,
  ConditionalExpression: TSESTree.ConditionalExpression,
  ContinueStatement: TSESTree.ContinueStatement,
  DebuggerStatement: TSESTree.DebuggerStatement,
  Decorator: TSESTree.Decorator,
  DoWhileStatement: TSESTree.DoWhileStatement,
  EmptyStatement: TSESTree.EmptyStatement,
  ExportAllDeclaration: TSESTree.ExportAllDeclaration,
  ExportDefaultDeclaration: TSESTree.ExportDefaultDeclaration,
  ExportNamedDeclarationWithoutSourceWithMultiple: TSESTree.ExportNamedDeclarationWithoutSourceWithMultiple,
  ExportNamedDeclarationWithoutSourceWithSingle: TSESTree.ExportNamedDeclarationWithoutSourceWithSingle,
  ExportNamedDeclarationWithSource: TSESTree.ExportNamedDeclarationWithSource,
  ExportSpecifier: TSESTree.ExportSpecifier,
  ExpressionStatement: TSESTree.ExpressionStatement,
  ForInStatement: TSESTree.ForInStatement,
  ForOfStatement: TSESTree.ForOfStatement,
  ForStatement: TSESTree.ForStatement,
  FunctionDeclarationWithName: TSESTree.FunctionDeclarationWithName,
  FunctionDeclarationWithOptionalName: TSESTree.FunctionDeclarationWithOptionalName,
  FunctionExpression: TSESTree.FunctionExpression,
  Identifier: TSESTree.Identifier,
  IdentifierToken: TSESTree.IdentifierToken,
  IfStatement: TSESTree.IfStatement,
  ImportAttribute: TSESTree.ImportAttribute,
  ImportDeclaration: TSESTree.ImportDeclaration,
  ImportDefaultSpecifier: TSESTree.ImportDefaultSpecifier,
  ImportExpression: TSESTree.ImportExpression,
  ImportNamespaceSpecifier: TSESTree.ImportNamespaceSpecifier,
  ImportSpecifier: TSESTree.ImportSpecifier,
  JSXAttribute: TSESTree.JSXAttribute,
  JSXClosingElement: TSESTree.JSXClosingElement,
  JSXClosingFragment: TSESTree.JSXClosingFragment,
  JSXElement: TSESTree.JSXElement,
  JSXEmptyExpression: TSESTree.JSXEmptyExpression,
  JSXExpressionContainer: TSESTree.JSXExpressionContainer,
  JSXFragment: TSESTree.JSXFragment,
  JSXIdentifier: TSESTree.JSXIdentifier,
  JSXIdentifierToken: TSESTree.JSXIdentifierToken,
  JSXMemberExpression: TSESTree.JSXMemberExpression,
  JSXNamespacedName: TSESTree.JSXNamespacedName,
  JSXOpeningElement: TSESTree.JSXOpeningElement,
  JSXOpeningFragment: TSESTree.JSXOpeningFragment,
  JSXSpreadAttribute: TSESTree.JSXSpreadAttribute,
  JSXSpreadChild: TSESTree.JSXSpreadChild,
  JSXText: TSESTree.JSXText,
  JSXTextToken: TSESTree.JSXTextToken,
  KeywordToken: TSESTree.KeywordToken,
  LabeledStatement: TSESTree.LabeledStatement,
  LetOrConstOrVarDeclaration: TSESTree.LetOrConstOrVarDeclaration,
  LetOrConstOrVarDeclarator: TSESTree.LetOrConstOrVarDeclarator,
  LineComment: TSESTree.LineComment,
  LogicalExpression: TSESTree.LogicalExpression,
  MemberExpressionComputedName: TSESTree.MemberExpressionComputedName,
  MemberExpressionNonComputedName: TSESTree.MemberExpressionNonComputedName,
  MetaProperty: TSESTree.MetaProperty,
  MethodDefinitionComputedName: TSESTree.MethodDefinitionComputedName,
  MethodDefinitionNonComputedName: TSESTree.MethodDefinitionNonComputedName,
  NewExpression: TSESTree.NewExpression,
  NodeOrTokenData: TSESTree.NodeOrTokenData,
  NullLiteral: TSESTree.NullLiteral,
  NullToken: TSESTree.NullToken,
  NumberLiteral: TSESTree.NumberLiteral,
  NumericToken: TSESTree.NumericToken,
  ObjectExpression: TSESTree.ObjectExpression,
  ObjectPattern: TSESTree.ObjectPattern,
  Position: TSESTree.Position,
  PrivateIdentifier: TSESTree.PrivateIdentifier,
  Program: TSESTree.Program,
  PropertyComputedName: TSESTree.PropertyComputedName,
  PropertyDefinitionComputedName: TSESTree.PropertyDefinitionComputedName,
  PropertyDefinitionNonComputedName: TSESTree.PropertyDefinitionNonComputedName,
  PropertyNonComputedName: TSESTree.PropertyNonComputedName,
  PunctuatorToken: TSESTree.PunctuatorToken,
  PunctuatorTokenToText: TSESTree.PunctuatorTokenToText,
  RegExpLiteral: TSESTree.RegExpLiteral,
  RegularExpressionToken: TSESTree.RegularExpressionToken,
  RestElement: TSESTree.RestElement,
  ReturnStatement: TSESTree.ReturnStatement,
  SequenceExpression: TSESTree.SequenceExpression,
  SourceLocation: TSESTree.SourceLocation,
  SpreadElement: TSESTree.SpreadElement,
  StaticBlock: TSESTree.StaticBlock,
  StringLiteral: TSESTree.StringLiteral,
  StringToken: TSESTree.StringToken,
  Super: TSESTree.Super,
  SwitchCase: TSESTree.SwitchCase,
  SwitchStatement: TSESTree.SwitchStatement,
  TaggedTemplateExpression: TSESTree.TaggedTemplateExpression,
  TemplateElement: TSESTree.TemplateElement,
  TemplateLiteral: TSESTree.TemplateLiteral,
  TemplateToken: TSESTree.TemplateToken,
  ThisExpression: TSESTree.ThisExpression,
  ThrowStatement: TSESTree.ThrowStatement,
  TryStatement: TSESTree.TryStatement,
  TSAbstractAccessorPropertyComputedName: TSESTree.TSAbstractAccessorPropertyComputedName,
  TSAbstractAccessorPropertyNonComputedName: TSESTree.TSAbstractAccessorPropertyNonComputedName,
  TSAbstractKeyword: TSESTree.TSAbstractKeyword,
  TSAbstractMethodDefinitionComputedName: TSESTree.TSAbstractMethodDefinitionComputedName,
  TSAbstractMethodDefinitionNonComputedName: TSESTree.TSAbstractMethodDefinitionNonComputedName,
  TSAbstractPropertyDefinitionComputedName: TSESTree.TSAbstractPropertyDefinitionComputedName,
  TSAbstractPropertyDefinitionNonComputedName: TSESTree.TSAbstractPropertyDefinitionNonComputedName,
  TSAnyKeyword: TSESTree.TSAnyKeyword,
  TSArrayType: TSESTree.TSArrayType,
  TSAsExpression: TSESTree.TSAsExpression,
  TSAsyncKeyword: TSESTree.TSAsyncKeyword,
  TSBigIntKeyword: TSESTree.TSBigIntKeyword,
  TSBooleanKeyword: TSESTree.TSBooleanKeyword,
  TSCallSignatureDeclaration: TSESTree.TSCallSignatureDeclaration,
  TSClassImplements: TSESTree.TSClassImplements,
  TSConditionalType: TSESTree.TSConditionalType,
  TSConstructorType: TSESTree.TSConstructorType,
  TSConstructSignatureDeclaration: TSESTree.TSConstructSignatureDeclaration,
  TSDeclareFunction: TSESTree.TSDeclareFunction,
  TSDeclareKeyword: TSESTree.TSDeclareKeyword,
  TSEmptyBodyFunctionExpression: TSESTree.TSEmptyBodyFunctionExpression,
  TSEnumDeclaration: TSESTree.TSEnumDeclaration,
  TSEnumMemberComputedName: TSESTree.TSEnumMemberComputedName,
  TSEnumMemberNonComputedName: TSESTree.TSEnumMemberNonComputedName,
  TSExportAssignment: TSESTree.TSExportAssignment,
  TSExportKeyword: TSESTree.TSExportKeyword,
  TSExternalModuleReference: TSESTree.TSExternalModuleReference,
  TSFunctionType: TSESTree.TSFunctionType,
  TSImportEqualsDeclaration: TSESTree.TSImportEqualsDeclaration,
  TSImportType: TSESTree.TSImportType,
  TSIndexedAccessType: TSESTree.TSIndexedAccessType,
  TSIndexSignature: TSESTree.TSIndexSignature,
  TSInferType: TSESTree.TSInferType,
  TSInstantiationExpression: TSESTree.TSInstantiationExpression,
  TSInterfaceBody: TSESTree.TSInterfaceBody,
  TSInterfaceDeclaration: TSESTree.TSInterfaceDeclaration,
  TSInterfaceHeritage: TSESTree.TSInterfaceHeritage,
  TSIntersectionType: TSESTree.TSIntersectionType,
  TSIntrinsicKeyword: TSESTree.TSIntrinsicKeyword,
  TSLiteralType: TSESTree.TSLiteralType,
  TSMappedType: TSESTree.TSMappedType,
  TSMethodSignatureComputedName: TSESTree.TSMethodSignatureComputedName,
  TSMethodSignatureNonComputedName: TSESTree.TSMethodSignatureNonComputedName,
  TSModuleBlock: TSESTree.TSModuleBlock,
  TSModuleDeclarationGlobal: TSESTree.TSModuleDeclarationGlobal,
  TSModuleDeclarationModuleWithIdentifierId: TSESTree.TSModuleDeclarationModuleWithIdentifierId,
  TSModuleDeclarationModuleWithStringIdDeclared: TSESTree.TSModuleDeclarationModuleWithStringIdDeclared,
  TSModuleDeclarationModuleWithStringIdNotDeclared: TSESTree.TSModuleDeclarationModuleWithStringIdNotDeclared,
  TSModuleDeclarationNamespace: TSESTree.TSModuleDeclarationNamespace,
  TSNamedTupleMember: TSESTree.TSNamedTupleMember,
  TSNamespaceExportDeclaration: TSESTree.TSNamespaceExportDeclaration,
  TSNeverKeyword: TSESTree.TSNeverKeyword,
  TSNonNullExpression: TSESTree.TSNonNullExpression,
  TSNullKeyword: TSESTree.TSNullKeyword,
  TSNumberKeyword: TSESTree.TSNumberKeyword,
  TSObjectKeyword: TSESTree.TSObjectKeyword,
  TSOptionalType: TSESTree.TSOptionalType,
  TSParameterProperty: TSESTree.TSParameterProperty,
  TSPrivateKeyword: TSESTree.TSPrivateKeyword,
  TSPropertySignatureComputedName: TSESTree.TSPropertySignatureComputedName,
  TSPropertySignatureNonComputedName: TSESTree.TSPropertySignatureNonComputedName,
  TSProtectedKeyword: TSESTree.TSProtectedKeyword,
  TSPublicKeyword: TSESTree.TSPublicKeyword,
  TSQualifiedName: TSESTree.TSQualifiedName,
  TSReadonlyKeyword: TSESTree.TSReadonlyKeyword,
  TSRestType: TSESTree.TSRestType,
  TSSatisfiesExpression: TSESTree.TSSatisfiesExpression,
  TSStaticKeyword: TSESTree.TSStaticKeyword,
  TSStringKeyword: TSESTree.TSStringKeyword,
  TSSymbolKeyword: TSESTree.TSSymbolKeyword,
  TSTemplateLiteralType: TSESTree.TSTemplateLiteralType,
  TSThisType: TSESTree.TSThisType,
  TSTupleType: TSESTree.TSTupleType,
  TSTypeAliasDeclaration: TSESTree.TSTypeAliasDeclaration,
  TSTypeAnnotation: TSESTree.TSTypeAnnotation,
  TSTypeAssertion: TSESTree.TSTypeAssertion,
  TSTypeLiteral: TSESTree.TSTypeLiteral,
  TSTypeOperator: TSESTree.TSTypeOperator,
  TSTypeParameter: TSESTree.TSTypeParameter,
  TSTypeParameterDeclaration: TSESTree.TSTypeParameterDeclaration,
  TSTypeParameterInstantiation: TSESTree.TSTypeParameterInstantiation,
  TSTypePredicate: TSESTree.TSTypePredicate,
  TSTypeQuery: TSESTree.TSTypeQuery,
  TSTypeReference: TSESTree.TSTypeReference,
  TSUndefinedKeyword: TSESTree.TSUndefinedKeyword,
  TSUnionType: TSESTree.TSUnionType,
  TSUnknownKeyword: TSESTree.TSUnknownKeyword,
  TSVoidKeyword: TSESTree.TSVoidKeyword,
  UnaryExpression: TSESTree.UnaryExpression,
  UpdateExpression: TSESTree.UpdateExpression,
  UsingInForOfDeclaration: TSESTree.UsingInForOfDeclaration,
  UsingInForOfDeclarator: TSESTree.UsingInForOfDeclarator,
  UsingInNomalConextDeclarator: TSESTree.UsingInNomalConextDeclarator,
  UsingInNormalContextDeclaration: TSESTree.UsingInNormalContextDeclaration,
  WhileStatement: TSESTree.WhileStatement,
  WithStatement: TSESTree.WithStatement,
  YieldExpression: TSESTree.YieldExpression,
}