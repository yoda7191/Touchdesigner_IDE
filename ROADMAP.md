# TouchDesigner IDE — Project Roadmap

This document outlines the planned development and milestones for the TouchDesigner IDE Visual Studio Code extension.

---

## Current Status (Version 0.4.0) — Completed

The core communication bridge, editing tools, automated release pipeline, and GLSL tools are fully functional:

- **Live Communication Bridge**: Two-way WebSocket connection between VS Code and TouchDesigner.
- **Node & Parameter Autocompletion**: Live suggestions for `op('...')` and `.par.` matching active nodes in TouchDesigner.
- **Remote Code Execution**: Run selected code or single lines in TouchDesigner using visual Play buttons or shortcuts (`Cmd + Enter` / `Ctrl + Enter`).
- **Integrated Textport**: Real-time streaming of TouchDesigner `print()` statements and error tracebacks directly into VS Code.
- **Operator Tree Sidebar**: Hierarchical view of the TouchDesigner network with one-click DAT editing and live connection status badges.
- **Interactive Python Console (REPL)**: Integrated terminal session with command history for testing code live.
- **Code Templates (Snippets)**: Quick boilerplates for Execute DATs, Script OPs, Component Extensions, and GLSL shaders.
- **Go to Definition**: Jump directly to DATs and extension methods using `F12` or `Cmd + Click`.
- **Universal Bridge Installer**: One-click command in VS Code to copy the bridge setup code directly to the clipboard, with automatic `.tox` export.
- **Automated GitHub Releases**: GitHub Actions pipeline that packages the `.vsix` installer and creates GitHub releases automatically upon version tagging.
- **Real-Time GLSL Live Reload**: Automatically reloads and recompiles dependent GLSL TOPs, GLSL Multi TOPs, and GLSL MATs when saving shader files in VS Code.
- **Shader Compile Error Highlighting**: Displays TouchDesigner GLSL compilation errors with red underline markers directly on the offending line in VS Code.
- **Creative Shader Presets**: Built-in templates for raymarching SDFs, feedback trails, procedural FBM noise, chromatic aberration, and compute shaders.
- **Official Licensing & Links**: Apache 2.0 license and repository links configured for publisher `MajaRoczek`.

---

## Phase 4: Workflow Tools & Parameter Inspection (Version 0.5.0) — Next Up

Bring visual TouchDesigner controls directly into VS Code to reduce window switching:

- **Visual Parameter Panel**: A sidebar tab in VS Code that renders live sliders, color pickers, and toggle buttons for any selected operator, allowing you to tweak values in real time without leaving your code.
- **Batch DAT Externalizer**: A utility command to externalize all script DATs in a component into an organized local project folder with automatic two-way file synchronization.
- **Multiple TouchDesigner Instances**: Support connecting to multiple running TouchDesigner instances simultaneously (for example, multi-machine setups or separate render/logic processes).

---

## Phase 5: Visual Previews & Advanced Features (Version 1.0.0)

- **Live TOP Previews on Hover**: Hovering over any TOP operator in code shows a small live thumbnail image preview of its current texture buffer directly in the tooltip.
- **CHOP Channel Inspection**: Quick graph visualizer in the sidebar showing real-time waveform data for monitored CHOP channels.
- **TouchDesigner Documentation Links**: Quick-open links to the official Derivative wiki for any built-in operator or Python class.

