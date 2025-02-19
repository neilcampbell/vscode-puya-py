import { window, WorkspaceFolder } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import { exec } from 'child_process'
import { PythonConfig, getPythonEnvironment } from './python-environment'

const clients: Map<string, LanguageClient> = new Map()

type ServerCommand = {
  command: string
  args?: string[]
}

async function testLspCandidate(command: string, options?: { env?: NodeJS.ProcessEnv }): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      exec(command, { env: options?.env }, (error: Error | null) => {
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

  // Try first candidate: python -m puyapy.lsp --version
  const firstCandidate = `"${config.pythonPath}" -m puyapy.lsp --version`
  if (await testLspCandidate(firstCandidate, { env: { VIRTUAL_ENV: config.envPath } })) {
    return {
      command: config.pythonPath,
      args: ['-m', 'puyapy.lsp'],
    }
  }

  // Try second candidate: puyapy-lsp --version
  const secondCandidate = 'puyapy-lsp --version'
  if (await testLspCandidate(secondCandidate)) {
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
    window.showErrorMessage('PuyaPy LSP is not installed or not available in the current environment.')
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
    `pupapyLsp-${workspaceFolder.name}`,
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
