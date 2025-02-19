import { workspace, ExtensionContext, window, TextDocument, Uri } from 'vscode'
import { PythonExtension } from '@vscode/python-extension'
import { startLanguageServer, restartLanguageServer, stopAllLanguageServers } from './language-server'

async function onDocumentOpenedHandler(context: ExtensionContext, document: TextDocument) {
  if (document.languageId === 'python') {
    const folder = workspace.getWorkspaceFolder(document.uri)
    if (folder) {
      await startLanguageServer(folder)

      // Handle language server path configuration changes
      context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (event) => {
          if (event.affectsConfiguration('puyapy.languageServerPath', folder)) {
            await restartLanguageServer(folder)
          }
        })
      )
    }
  }
}

// TODO: command to restart language server for a specific workspace folder

async function onPythonEnvironmentChangedHandler(resource: Uri) {
  const folder = workspace.getWorkspaceFolder(resource)
  if (folder) {
    await restartLanguageServer(folder)
  }
}

export async function activate(context: ExtensionContext) {
  const pythonApi = await PythonExtension.api()

  // Handle already opened Python documents
  if (window.activeTextEditor?.document.languageId === 'python') {
    await onDocumentOpenedHandler(context, window.activeTextEditor.document)
  }

  // Setup handler for newly opened Python documents
  context.subscriptions.push(
    workspace.onDidOpenTextDocument(async (document: TextDocument) => {
      if (document.languageId === 'python') {
        await onDocumentOpenedHandler(context, document)
      }
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
        await restartLanguageServer(folder)
      }
    })
  )
}

export async function deactivate(): Promise<void> {
  await stopAllLanguageServers()
}
