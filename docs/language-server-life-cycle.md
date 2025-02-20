# Language Server Management

## Starting the Language Server

The extension manages language server instances on a per-workspace folder basis. Here's how it works:

1. **Initialization Triggers**

   - When a Python file is opened (both initially and for new files)
   - When the extension is activated and there's an active Python file

2. **Python Environment Detection**

   - Uses the `@vscode/python-extension` API to detect the active Python environment
   - Retrieves:
     - Environment ID
     - Environment path (`sysPrefix`)
     - Python executable path

3. **LSP Server Command Detection**
   The extension attempts to find the PuyaPy LSP server in the following order:

   a. **First Attempt**: Try as a Python module

   ```bash
   python -m puyapy.lsp --version
   ```

   If successful, will use: `pythonPath -m puyapy.lsp`

   b. **Second Attempt**: Try as a global command

   ```bash
   puyapy-lsp --version
   ```

   If successful, will use: `puyapy-lsp`

4. **Server Initialization**
   - Creates a new Language Client with:
     - Unique ID based on workspace folder name
     - stdio transport
     - Environment variables including `VIRTUAL_ENV`
   - Configures document selector for Python files within the workspace
   - Stores client instance in a Map keyed by workspace folder name

## Handling Interpreter Changes

The extension actively monitors and responds to Python environment changes:

1. **Event Listening**

   - Subscribes to `onDidChangeActiveEnvironmentPath` from the Python extension
   - Triggers when user changes Python interpreter in VS Code

2. **Server Restart Process**
   - Stops the existing language server for the affected workspace
   - Removes the client from the tracking Map
   - Initiates a new server start process with the updated environment

## Error Handling

- If PuyaPy LSP is not found in the environment, shows an error message to the user
- Gracefully handles cases where Python environment cannot be resolved

## Cleanup

On deactivation:

- Stops all running language server instances
- Clears the client tracking Map

## Restarting the Language Server

Users can manually restart the language server using the VS Code command palette:

1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Search for and select "PuyaPy: Restart Language Server"

This will:

- Restart the currently running language server instance associated with the active folder

## Notes

- The extension maintains separate language server instances for each workspace folder
- Environment variables (particularly `VIRTUAL_ENV`) are properly set to ensure correct package resolution
- The system is designed to be resilient to environment changes and workspace modifications
