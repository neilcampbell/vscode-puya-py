import { window, WorkspaceFolder } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import { exec } from 'child_process'
import { PythonConfig, getPythonEnvironment } from './python-environment'

const clients: Map<string, LanguageClient> = new Map()

type ServerCommand = {
  command: string
  args?: string[]
}

async function tryToRunCommand(command: string): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      exec(command, (error: Error | null) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
    return true
  } catch {
    return false
  }
}

async function findStartServerCommand(config: PythonConfig): Promise<ServerCommand | undefined> {
  if (!config.pythonPath || !config.envPath) {
    return undefined
  }

  const startWithPython = `"${config.pythonPath}" -m puyapy.lsp --version`
  if (await tryToRunCommand(startWithPython)) {
    return {
      command: config.pythonPath,
      args: ['-m', 'puyapy.lsp'],
    }
  }

  const startWithPuyapyLsp = 'puyapy-lsp --version'
  if (await tryToRunCommand(startWithPuyapyLsp)) {
    return {
      command: 'puyapy-lsp',
    }
  }

  return undefined
}

export async function restartLanguageServer(workspaceFolder: WorkspaceFolder) {
  const client = clients.get(workspaceFolder.name)
  if (client) {
    await client.stop()
    clients.delete(workspaceFolder.name)
  }

  await startLanguageServer(workspaceFolder)
}

export async function startLanguageServer(workspaceFolder: WorkspaceFolder) {
  if (clients.has(workspaceFolder.name)) {
    return
  }

  const pythonConfig = await getPythonEnvironment(workspaceFolder?.uri)

  if (!pythonConfig || !pythonConfig.envPath || !pythonConfig.pythonPath) {
    return
  }

  const startServerCommand = await findStartServerCommand(pythonConfig)
  if (!startServerCommand) {
    window.showErrorMessage('PuyaPy language server is not installed in the current environment.')
    return
  }

  // TODO: handle setting from settings.json

  const serverOptions: ServerOptions = {
    command: startServerCommand.command,
    args: startServerCommand.args,
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
    `pupapy-${workspaceFolder.name}`,
    `PuyaPy Language Server - ${workspaceFolder.name}`,
    serverOptions,
    clientOptions
  )

  clients.set(workspaceFolder.name, client)

  // Start the client. This will also launch the server
  await client.start()
}

export async function stopAllLanguageServers(): Promise<void> {
  const promises = Array.from(clients.values()).map((client) => client.stop())
  await Promise.all(promises)
  clients.clear()
}
