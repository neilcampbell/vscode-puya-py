import { window } from 'vscode'
import { WorkspaceFolder } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'

const clients: Map<string, LanguageClient> = new Map()

export async function startLanguageServer(workspaceFolder: WorkspaceFolder) {
  if (clients.has(workspaceFolder.name)) {
    return
  }

  const serverOptions: ServerOptions = {
    command: 'npx',
    args: ['run-language-server'],
    transport: TransportKind.stdio,
    options: {
      cwd: workspaceFolder.uri.fsPath,
      shell: true,
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
