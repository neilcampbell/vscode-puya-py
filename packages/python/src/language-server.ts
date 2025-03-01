import { window, workspace, WorkspaceFolder } from 'vscode'
import {
  createServerSocketTransport,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { exec } from 'child_process'
import { PythonConfig, getPythonEnvironment } from './environment'
import { startedInDebugMode } from '../../common/utils/started-in-debug-mode'

const languageServerName = 'Algorand Python Language Server'

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

  const startWithPuyapyLsp = 'puyapy.lsp --help' // TODO: Switch to --version if/when supported

  const startWithPython = `"${config.pythonPath}" -m ${startWithPuyapyLsp}`
  if (await tryToRunCommand(startWithPython)) {
    return {
      command: config.pythonPath,
      args: ['-m', 'puyapy.lsp'],
    }
  }

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

  const config = workspace.getConfiguration('puyapy', workspaceFolder.uri)
  let languageServerPath = config.get<string>('languageServerPath')

  // Resolve ${workspaceFolder} if present
  // Doesn't seems to be a better way to handle this
  // https://github.com/microsoft/vscode/issues/46471
  // likely we will need to use this https://github.com/DominicVonk/vscode-variables
  // TODO: handle all predefined variables
  if (languageServerPath && languageServerPath.includes('${workspaceFolder}')) {
    languageServerPath = languageServerPath.replace('${workspaceFolder}', workspaceFolder.uri.fsPath)
  }

  let startServerCommand: ServerCommand | undefined
  if (languageServerPath) {
    startServerCommand = {
      command: 'puyapy-lsp',
    }
  } else {
    startServerCommand = await findStartServerCommand(pythonConfig)
  }

  const outputChannel = window.createOutputChannel(languageServerName)

  if (!startServerCommand) {
    outputChannel.appendLine(`The Algorand Python language server was not found in the current environment.`)
    return
  }

  const serverOptions: ServerOptions = startedInDebugMode()
    ? async () => {
        const transport = createServerSocketTransport(8888)
        return { reader: transport[0], writer: transport[1] }
      }
    : {
        command: startServerCommand.command,
        args: startServerCommand.args,
        transport: TransportKind.stdio,
        options: {
          env: {
            VIRTUAL_ENV: `${pythonConfig.envPath}`,
            NO_COLOR: '1',
            PYTHONUTF8: '1',
          },
          ...(languageServerPath && { cwd: languageServerPath }),
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
    initializationOptions: {
      analysisPrefix: pythonConfig.envPath,
    },
    outputChannel,
  }

  const client = new LanguageClient(
    `pupapy-${workspaceFolder.name}`,
    `${languageServerName} - ${workspaceFolder.name}`,
    serverOptions,
    clientOptions
  )

  try {
    // Start the client. This will also launch the server
    await client.start()
    clients.set(workspaceFolder.name, client)
  } catch {
    window.showErrorMessage('Failed to start the Algorand Python language server.')
  }
}

export async function stopAllLanguageServers(): Promise<void> {
  const promises = Array.from(clients.values()).map((client) => client.stop())
  await Promise.all(promises)
  clients.clear()
}
