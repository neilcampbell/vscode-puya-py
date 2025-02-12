/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  CodeAction,
  CodeActionKind,
  WorkspaceEdit,
  TextEdit,
  CompletionItemKind,
  TextDocumentPositionParams,
  CompletionItem,
} from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument)

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration)
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders)

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
      // Advertise code action support so that quick fixes are available.
      codeActionProvider: {
        resolveProvider: false,
      },
    },
  }
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    }
  }
  return result
})

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.')
    })
  }
})

// The example settings
interface LspSettings {
  maxNumberOfProblems: number
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: LspSettings = { maxNumberOfProblems: 1000 }
let globalSettings: LspSettings = defaultSettings

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<LspSettings>>()

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear()
  } else {
    globalSettings = change.settings.pupapyLsp || defaultSettings
  }
  // Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
  // We could optimize things here and re-fetch the setting first can compare it
  // to the existing setting, but this is out of scope for this example.
  connection.languages.diagnostics.refresh()
})

function getDocumentSettings(resource: string): Thenable<LspSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings)
  }
  let result = documentSettings.get(resource)
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'pupapyLsp',
    })
    documentSettings.set(resource, result)
  }
  return result
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri)
})

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
  const diagnostics = await validateTextDocument(change.document)
  connection.sendDiagnostics({
    uri: change.document.uri,
    diagnostics: diagnostics,
  })
})

async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
  // In this simple example we get the settings for every validate run.
  const settings = await getDocumentSettings(textDocument.uri)

  // Get the text content of the document
  const text = textDocument.getText()

  let problems = 0
  const diagnostics: Diagnostic[] = []

  // New code: Check for Python list usage ("list(" detection)
  const listPattern = /list\(/g
  let listMatch: RegExpExecArray | null
  while ((listMatch = listPattern.exec(text)) && problems < settings.maxNumberOfProblems) {
    problems++
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(listMatch.index),
        end: textDocument.positionAt(listMatch.index + 5), // "list(" is 5 characters
      },
      message: "Python list isn't supported in Algorand Python",
      source: 'ex',
    }
    diagnostics.push(diagnostic)
  }

  return diagnostics
}

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log('We received a file change event')
})

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  // The pass parameter contains the position of the text document in
  // which code complete got requested. For the example we ignore this
  // info and always provide the same completion items.
  return [
    {
      label: 'TypeScript',
      kind: CompletionItemKind.Text,
      data: 1,
    },
    {
      label: 'JavaScript',
      kind: CompletionItemKind.Text,
      data: 2,
    },
  ]
})

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data === 1) {
    item.detail = 'TypeScript details'
    item.documentation = 'TypeScript documentation'
  } else if (item.data === 2) {
    item.detail = 'JavaScript details'
    item.documentation = 'JavaScript documentation'
  }
  return item
})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Code Action: Fix "list(" issue by replacing it with "arc4.Array(".
connection.onCodeAction((params) => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return []
  }

  const codeActions: CodeAction[] = []

  for (const diagnostic of params.context.diagnostics) {
    if (diagnostic.message === "Python list isn't supported in Algorand Python") {
      const fix: WorkspaceEdit = {
        changes: {
          [params.textDocument.uri]: [TextEdit.replace(diagnostic.range, 'arc4.Array(')],
        },
      }
      const action: CodeAction = {
        title: "Replace 'list' with 'arc4.Array'",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: fix,
      }
      codeActions.push(action)
    }
  }

  return codeActions
})

// Listen on the connection
connection.listen()
