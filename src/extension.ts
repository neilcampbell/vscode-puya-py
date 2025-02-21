import { workspace, ExtensionContext, window, TextDocument, Uri, commands } from 'vscode'
import { PythonExtension } from '@vscode/python-extension'
import {
  startLanguageServer as startPythonLanguageServer,
  restartLanguageServer as restartPythonLanguageServer,
  stopAllLanguageServers as stopPythonLanguageServers,
} from './features/python/language-server'
import { startLanguageServer as startTypeScriptLanguageServer } from './features/typescript/language-server'

async function onDocumentOpenedHandler(context: ExtensionContext, document: TextDocument) {
  if (document.languageId === 'python') {
    const folder = workspace.getWorkspaceFolder(document.uri)
    if (folder) {
      await startPythonLanguageServer(folder)

      // Handle language server path configuration changes
      context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (event) => {
          if (event.affectsConfiguration('puyapy.languageServerPath', folder)) {
            await restartPythonLanguageServer(folder)
          }
        })
      )
    }
  }
  if (document.languageId === 'typescript') {
    const folder = workspace.getWorkspaceFolder(document.uri)
    if (folder) {
      await startTypeScriptLanguageServer(folder)
    }
  }
}

async function onPythonEnvironmentChangedHandler(resource: Uri) {
  const folder = workspace.getWorkspaceFolder(resource)
  if (folder) {
    await restartPythonLanguageServer(folder)
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

  await restartPythonLanguageServer(folder)
  window.showInformationMessage('PupaPy language server restarted successfully')
}

export async function activate(context: ExtensionContext) {
  // TODO: check if the python extension is installed
  const pythonApi = await PythonExtension.api()

  // Register restart command
  context.subscriptions.push(commands.registerCommand('puyapy.restartLanguageServer', restartLanguageServerCommand))

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

  // Handle interpreter changes
  context.subscriptions.push(
    pythonApi.environments.onDidChangeActiveEnvironmentPath(async (e) => {
      if (e.resource) {
        // TODO: what happen if the resource is undefined?
        await onPythonEnvironmentChangedHandler(e.resource.uri)
      }
    })
  )

  // Handle workspace folder removal
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.removed) {
        await restartPythonLanguageServer(folder)
      }
    })
  )
}

export async function deactivate(): Promise<void> {
  await stopPythonLanguageServers()
}
