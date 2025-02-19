/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext, window, TextDocument, Uri } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import { PythonExtension } from '@vscode/python-extension'

// Map to store language clients by workspace folder name
const clients: Map<string, LanguageClient> = new Map()

type PythonConfig = {
  /*
   * Path to the Python environment, undefined if global
   */
  envPath?: string
  /*
   * Path to the Python executable, undefined if no executable found
   */
  pythonPath?: string
}

export async function getPythonEnvironment(resource?: Uri): Promise<PythonConfig | undefined> {
  const api = await PythonExtension.api()
  const environment = await api?.environments.resolveEnvironment(api?.environments.getActiveEnvironmentPath(resource))
  if (!environment) {
    return undefined
  }
  return {
    envPath: environment.environment?.folderUri.fsPath,
    pythonPath: environment.executable.uri?.fsPath,
  }
}

async function startLanguageServer(document: TextDocument) {
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri)
  if (!workspaceFolder) return

  // Check if client already exists for this workspace folder
  if (clients.has(workspaceFolder.name)) {
    return
  }

  const pythonConfig = await getPythonEnvironment(workspaceFolder.uri)
  if (!pythonConfig || !pythonConfig.envPath || !pythonConfig.pythonPath) {
    // TODO: handle env
    return
  }
  // TODO: handle setting from settings.json

  // Setup the language server using poetry
  const serverOptions: ServerOptions = {
    command: pythonConfig.pythonPath,
    args: ['-m', 'puyapy.lsp'],
    transport: TransportKind.stdio,
    options: {
      env: {
        VIRTUAL_ENV: `${pythonConfig.envPath}`,
      },
    },
  }

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'python',
        pattern: `${workspaceFolder.uri.fsPath}/**/*`, // Only match files in this workspace folder
      },
    ],
    synchronize: {
      // TODO: restart the server if the configuration changes
    },
    workspaceFolder: workspaceFolder, // Specify the workspace folder this client is for
  }

  // Create the language client with unique ID and name for this workspace
  const client = new LanguageClient(
    `pupapyLsp-${workspaceFolder.name}`, // Unique ID per workspace
    `PuyaPy Language Server - ${workspaceFolder.name}`, // Unique name per workspace
    serverOptions,
    clientOptions
  )

  // Store the client in our map
  clients.set(workspaceFolder.name, client)

  // Start the client. This will also launch the server
  await client.start()
}

export async function activate(context: ExtensionContext) {
  // Handle already opened Python documents first
  if (window.activeTextEditor?.document.languageId === 'python') {
    await startLanguageServer(window.activeTextEditor.document)
  }

  // Setup handler for newly opened Python documents
  const disposable = workspace.onDidOpenTextDocument(async (document: TextDocument) => {
    if (document.languageId === 'python') {
      await startLanguageServer(document)
    }
  })

  context.subscriptions.push(disposable)

  // Handle workspace folder removal
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.removed) {
        const client = clients.get(folder.name)
        if (client) {
          await client.stop()
          clients.delete(folder.name)
        }
      }
    })
  )
}

export async function deactivate(): Promise<void> {
  // Stop all clients
  const promises = Array.from(clients.values()).map((client) => client.stop())
  await Promise.all(promises)
  clients.clear()
}
