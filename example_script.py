# TouchDesigner IDE Playground
# Try running lines or selections using Cmd+Enter (Mac) / Ctrl+Enter (Windows)

# 1. Print directly to TouchDesigner Textport and VS Code console
print("Hello from VS Code TouchDesigner IDE!")

# 2. Inspect project properties
print("Project name:", project.name)
print("TouchDesigner build:", app.build)

# 3. Test operator autocompletion:
# Try typing `op('` below to see live node suggestions:
# op('/project1')

# 4. Test parameter autocompletion:
# Try typing `.par.` after any operator path:
# op('/project1').par.

# 5. Math / TDU utilities
p1 = tdu.Position(1, 2, 3)
p2 = tdu.Position(4, 5, 6)
print("Distance between positions:", (p2 - p1).length())

# 6. Test Snippets:
# On an empty line, try typing any of these prefixes:
#   td-ext       -> Creates a full TouchDesigner Python Extension class
#   td-chopexec  -> Creates CHOP Execute DAT callbacks
#   td-parexec   -> Creates Parameter Execute DAT callbacks
#   td-cook-dat  -> Creates Script DAT onCook() table generator
#   td-cook-chop -> Creates Script CHOP onCook() waveform generator
#   td-par-custom-> Creates Custom Parameters setup code
#   td-glsl-top  -> Creates GLSL TOP pixel shader template

# 7. Test Go to Definition (F12):
# Put your cursor on `op('/project1/td_vscode_bridge')` and press F12 (or Cmd+Click).
# It will jump directly to the operator's script!

# 8. Interactive REPL:
# Press Cmd+Shift+P -> "TouchDesigner: Open TouchDesigner Interactive REPL"
# to get an interactive `td >>> ` terminal directly in VS Code!


