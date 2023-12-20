import { PluginOption, defineConfig } from 'vite'
import type { AstNode } from "rollup"
import react from '@vitejs/plugin-react'
import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/types"
import { visitorKeys } from '@typescript-eslint/visitor-keys'
import MagicString from 'magic-string'
import { createHash } from 'node:crypto'


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
        return virtualCssFiles.get(id)
      }
    },
    transform: {
      handler(code, id, options) {
        if (!id.endsWith(".tsx")) return { code, ast: null, map: null }
        console.log('::id', id)
        const ast = this.parse(code)
        let cssString = ''
        const replacers: Array<{ start: number, end: number }> = []
        walkAst(ast as unknown as TSESTree.Program, {
          TaggedTemplateExpression(node) {
            if (node.tag.type !== "Identifier" || node.tag.name !== "css") return
            const quasi = node.quasi
            if (quasi.type !== "TemplateLiteral") return
            const { quasis: [quasiNode] } = quasi
            const css = quasiNode.value.raw
            cssString += '\n' + css
            replacers.push({ start: node.start, end: node.end })
          },
          CallExpression(node) {
            if (node.callee.type !== "Identifier" || node.callee.name !== "css") return
            const cssNode = node.arguments[0]
            if (cssNode.type === "Literal") {
              cssString += '\n' + cssNode.value
              replacers.push({ start: node.start, end: node.end })
            } else if (cssNode.type === "TemplateLiteral") {
              const { quasis: [quasiNode] } = cssNode
              const css = quasiNode.value.raw
              cssString += '\n' + css
              replacers.push({ start: node.start, end: node.end })
            }
          }
        })

        if (cssString === '') return { code, ast, map: null }

        const s = new MagicString(code)
        for (let i = replacers.length - 1; i >= 0; i--) {
          // s.update(11, 13, '42')
          const { start, end } = replacers[i]
          s.update(start, end, '__GENERATED_CLASSES_OBJECT__')
        }
        const foo = createHash('sha1').update(cssString).digest('base64')
        const cssFileName = foo + '.module.css'
        s.prepend(`import __GENERATED_CLASSES_OBJECT__ from '${cssFileName}';\n`)
        const map = s.generateMap({})
        const transformed = s.toString()

        virtualCssFiles.set(cssFileName, cssString)

        return {
          // ast,
          code: transformed,
          map,
          // code: string;
          // map?: SourceMapInput;
        }
      },
    }
  }
}

type Listener = {
  [key in keyof AllNodes]?: (node: AllNodes[key]) => void
} & {
    [key in keyof AllNodes as `${key}:exit`]?: (node: AllNodes[key]) => void
  }

function walkAst(ast: TSESTree.Node, listener: Listener) {

  const walker = <TNode extends TSESTree.Node>(node: TNode) => {
    if (node.type in listener) {
      listener[node.type](node)
    }

    const keys = visitorKeys[node.type] as ReadonlyArray<keyof TNode & string>
    for (const key of keys) {
      const child = node[key] as TSESTree.Node | TSESTree.Node[] | undefined
      if (!child) continue
      if (Array.isArray(child)) {
        for (const c of child) {
          walker(c)
        }
      } else if (child) {
        walker(child)
      }
    }
    if (`${node.type}:exit` in listener) {
      listener[`${node.type}:exit`](node)
    }
  }

  walker(ast)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [CssExtract(), react()],
  build: {
    sourcemap: true,
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