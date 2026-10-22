# TouchDesigner VS Code Bridge Component

This folder contains the companion component that connects TouchDesigner to the TouchDesigner IDE extension in Visual Studio Code.

## Quick Setup

### Method 1: Automatic Installer (Fastest)

1. In VS Code, run the command **TouchDesigner: Copy Bridge Installer Script to Clipboard** (or click **TD: Disconnected** on the bottom status bar and choose that option).
2. In TouchDesigner, open the Textport by pressing `Alt + T` on Windows, or `Cmd + T` on Mac.
3. Paste (`Ctrl + V` or `Cmd + V`) and press Enter.

Alternatively, if you have this file in your project folder, you can run:

```python
exec(open('install_bridge.py').read())
```

4. You will see:

```text
=================================================================
 [TD_VSCODE_BRIDGE] Installed successfully!
 [TD_VSCODE_BRIDGE] Operator:  /project1/td_vscode_bridge
 [TD_VSCODE_BRIDGE] WebSocket: ws://127.0.0.1:9988
=================================================================
```

---

### Method 2: Manual Component Setup

If you prefer to configure the component manually:

1. In TouchDesigner, add a Base COMP named `td_vscode_bridge`.
2. Inside it, add a Text DAT named `callbacks` and paste the contents of `td_vscode_bridge.py`.
3. Add a WebServer DAT named `webserver1`:
   - Set Port to `9988`.
   - Set Callbacks DAT to `callbacks`.
   - Ensure Active is set to `1`.

---

## Features Enabled by the Bridge

- **Live Operator Autocompletion**: Real-time autocomplete for `op('...')` matching all nodes in your active network.
- **Dynamic Parameter Suggestions**: Autocompletion for `.par.` with live parameter types, values, and custom parameters.
- **Remote Code Execution**: Execute highlighted Python code in TouchDesigner with `Cmd + Enter` / `Ctrl + Enter`.
- **Operator Tree Inspector**: Browse your network graph directly from the VS Code sidebar.
- **Two-Way DAT Sync**: Edit script DATs in VS Code; changes auto-sync to TouchDesigner on save.
- **TouchDesigner Textport Stream**: Real-time `print()` output and error tracebacks stream directly into VS Code.
