import { ChildProcess, spawn } from 'child_process'
import { window } from 'vscode'
import { WorkspaceFolder } from 'vscode'
import { LanguageClient, LanguageClientOptions, MessageTransports, ServerOptions, TransportKind } from 'vscode-languageclient/node'

const clients: Map<string, LanguageClient> = new Map()

async function tryToRunCommand(command: string): Promise<boolean> {
  try {
    const serverProcess = spawn('C:\\Program Files\\nodejs\\npx.cmd', ['-v'])
    if (!serverProcess || !serverProcess.pid) {
      handleChildProcessStartError(serverProcess, `Launching server using command ${command} failed.`)
      return false
    }
    return true
  } catch {
    return false
  }
}

function handleChildProcessStartError(process: ChildProcess, message: string) {
  if (process === null) {
    return Promise.reject<MessageTransports>(message)
  }

  return new Promise<MessageTransports>((_, reject) => {
    process.on('error', (err) => {
      reject(`${message} ${err}`)
    })
    // the error event should always be run immediately,
    // but race on it just in case
    setImmediate(() => reject(message))
  })
}

export async function startLanguageServer(workspaceFolder: WorkspaceFolder) {
  if (clients.has(workspaceFolder.name)) {
    return
  }

  tryToRunCommand('node -v')
  const serverOptions: ServerOptions = {
    command: 'C:\\Program Files\\nodejs\\npx.cmd',
    args: ['run-language-server'],
    transport: TransportKind.stdio,
    options: {
      cwd: workspaceFolder.uri.fsPath,
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'typescript',
        pattern: `${workspaceFolder.uri.fsPath}/**/*`,
      },
    ],
    workspaceFolder: workspaceFolder,
  }

  const client = new LanguageClient(
    `pupats-${workspaceFolder.name}`,
    `PuyaTS Language Server - ${workspaceFolder.name}`,
    serverOptions,
    clientOptions
  )

  try {
    // Start the client. This will also launch the server
    await client.start()
    clients.set(workspaceFolder.name, client)
  } catch {
    window.showErrorMessage('Failed to start PuyaTS language server.')
  }
}

export async function stopAllLanguageServers(): Promise<void> {
  const promises = Array.from(clients.values()).map((client) => client.stop())
  await Promise.all(promises)
  clients.clear()
}
