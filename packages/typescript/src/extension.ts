import { workspace, ExtensionContext, window, TextDocument, commands } from 'vscode'
import { startLanguageServer, restartLanguageServer, stopAllLanguageServers } from './language-server'

async function onDocumentOpenedHandler(context: ExtensionContext, document: TextDocument) {
  if (document.languageId === 'typescript' && document.uri.fsPath.endsWith('algo.ts')) {
    const folder = workspace.getWorkspaceFolder(document.uri)
    if (folder) {
      await startLanguageServer(folder)
    }
  }
}

async function restartLanguageServerCommand() {
  const editor = window.activeTextEditor
  if (!editor) {
    window.showErrorMessage('No active editor found')
    return
  }

  const folder = workspace.getWorkspaceFolder(editor.document.uri)
  if (!folder) {
    window.showErrorMessage('No workspace folder found for the current file')
    return
  }

  await restartLanguageServer(folder)
  window.showInformationMessage('Algorand TypeScript language server restarted successfully')
}

export async function activate(context: ExtensionContext) {
  // Register restart command
  context.subscriptions.push(commands.registerCommand('algorandTypescript.restartLanguageServer', restartLanguageServerCommand))

  // Handle already opened documents
  if (window.activeTextEditor?.document) {
    await onDocumentOpenedHandler(context, window.activeTextEditor.document)
  }

  // Setup handler for newly opened documents
  context.subscriptions.push(
    workspace.onDidOpenTextDocument(async (document: TextDocument) => {
      await onDocumentOpenedHandler(context, document)
    })
  )

  // Handle workspace folder removal
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.removed) {
        await restartLanguageServer(folder)
      }
    })
  )
}

export async function deactivate(): Promise<void> {
  await stopAllLanguageServers()
}
