/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext, window, TextDocument, Uri } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import { PythonExtension } from '@vscode/python-extension'

let client: LanguageClient

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
  if (client) {
    return
  }

  const workspaceFolder = workspace.getWorkspaceFolder(document.uri)
  if (!workspaceFolder) return

  const pythonConfig = await getPythonEnvironment(workspaceFolder!.uri)
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
    documentSelector: [{ language: 'python' }],
    synchronize: {
      // TODO: restart the server if the configuration changes
    },
  }

  // Create the language client and start the client.
  client = new LanguageClient('pupapyLsp', 'PuyaPy Language Server', serverOptions, clientOptions)

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
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}
