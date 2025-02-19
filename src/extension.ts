import { workspace, ExtensionContext, window, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import { PythonExtension } from '@vscode/python-extension'
import { exec } from 'child_process'

const clients: Map<string, LanguageClient> = new Map()

type PythonConfig = {
  id: string
  /*
   * Path to the Python environment, undefined if global
   */
  envPath?: string
  /*
   * Path to the Python executable, undefined if no executable found
   */
  pythonPath?: string
}

async function getPythonEnvironment(resource?: Uri): Promise<PythonConfig | undefined> {
  const api = await PythonExtension.api()
  const environment = await api?.environments.resolveEnvironment(api?.environments.getActiveEnvironmentPath(resource))
  if (!environment) {
    return undefined
  }
  return {
    id: environment.id,
    envPath: environment.environment?.folderUri.fsPath,
    pythonPath: environment.executable.uri?.fsPath,
  }
}

async function ensurePuyapyIsInstalled(config: PythonConfig): Promise<boolean> {
  if (!config.pythonPath || !config.envPath) {
    return false
  }

  const checkModuleCmd = `"${config.pythonPath}" -c "import puyapy"`
  try {
    await new Promise<void>((resolve, reject) => {
      exec(
        checkModuleCmd,
        {
          env: {
            VIRTUAL_ENV: config.envPath,
          },
        },
        (error: Error | null) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
      )
    })
    return true
  } catch {
    window.showErrorMessage('PuyaPy is not installed in the current environment.')
    return false
  }
}

async function restartLanguageServer(workspaceFolder: WorkspaceFolder) {
  const client = clients.get(workspaceFolder.name)
  if (client) {
    await client.stop()
    clients.delete(workspaceFolder.name)

    await startLanguageServer(workspaceFolder)
  }
}

async function startLanguageServer(workspaceFolder: WorkspaceFolder) {
  if (clients.has(workspaceFolder.name)) {
    return
  }

  const pythonConfig = await getPythonEnvironment(workspaceFolder?.uri)

  if (!pythonConfig || !pythonConfig.envPath || !pythonConfig.pythonPath) {
    // TODO: handle global env
    return
  }

  if (!(await ensurePuyapyIsInstalled(pythonConfig))) {
    return
  }

  // TODO: handle setting from settings.json

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

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'python',
        pattern: `${workspaceFolder.uri.fsPath}/**/*`,
      },
    ],
    workspaceFolder: workspaceFolder,
  }

  const client = new LanguageClient(
    `pupapyLsp-${workspaceFolder.name}`,
    `PuyaPy Language Server - ${workspaceFolder.name}`,
    serverOptions,
    clientOptions
  )

  clients.set(workspaceFolder.name, client)

  // Start the client. This will also launch the server
  await client.start()
}

async function onDocumentOpenedHandler(document: TextDocument) {
  if (document.languageId === 'python') {
    const folder = workspace.getWorkspaceFolder(document.uri)
    if (folder) {
      await startLanguageServer(folder)
    }
  }
}

async function onPythonEnvironmentChangedHandler(resource: Uri) {
  const folder = workspace.getWorkspaceFolder(resource)
  if (folder) {
    await restartLanguageServer(folder)
  }
}

export async function activate(context: ExtensionContext) {
  const pythonApi = await PythonExtension.api()

  // Handle interpreter changes
  context.subscriptions.push(
    pythonApi.environments.onDidChangeActiveEnvironmentPath(async (e) => {
      if (e.resource) {
        // TODO: what happen if the resource is undefined?
        await onPythonEnvironmentChangedHandler(e.resource.uri)
      }
    })
  )

  // Handle already opened Python documents
  if (window.activeTextEditor?.document.languageId === 'python') {
    await onDocumentOpenedHandler(window.activeTextEditor.document)
  }

  // Setup handler for newly opened Python documents
  const disposable = workspace.onDidOpenTextDocument(async (document: TextDocument) => {
    if (document.languageId === 'python') {
      await onDocumentOpenedHandler(document)
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
  const promises = Array.from(clients.values()).map((client) => client.stop())
  await Promise.all(promises)
  clients.clear()
}
