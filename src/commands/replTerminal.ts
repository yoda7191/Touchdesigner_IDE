import * as vscode from 'vscode';
import { tdClient } from '../bridge/tdClient';

export class TouchDesignerREPL implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  private closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidClose: vscode.Event<number | void> = this.closeEmitter.event;

  private currentLine: string = '';
  private cursorIndex: number = 0;
  private multiLineBuffer: string[] = [];
  private history: string[] = [];
  private historyIndex: number = -1;

  private readonly PROMPT_NORMAL = '\x1b[32;1mtd >>> \x1b[0m';
  private readonly PROMPT_MULTI = '\x1b[33m... \x1b[0m';

  constructor() {}

  public open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    const info = tdClient.serverInfo;
    const projectStr = info ? `${info.projectName} (TD ${info.tdBuild})` : 'TouchDesigner';

    this.writeEmitter.fire(
      '\r\n\x1b[1;36m================================================================\x1b[0m\r\n' +
      `\x1b[1;36m TouchDesigner Interactive Python REPL\x1b[0m\r\n` +
      `\x1b[90m Active Project: ${projectStr}\x1b[0m\r\n` +
      `\x1b[90m Press Enter to run. Use Up/Down for history. Type 'exit' to quit.\x1b[0m\r\n` +
      '\x1b[1;36m================================================================\x1b[0m\r\n\r\n'
    );
    this.showPrompt();
  }

  public close(): void {
    this.closeEmitter.fire();
  }

  public handleInput(data: string): void {
    // Check for control sequences
    if (data === '\r') {
      // Enter key
      this.handleEnter();
    } else if (data === '\x7f' || data === '\b') {
      // Backspace
      this.handleBackspace();
    } else if (data === '\x03') {
      // Ctrl+C (Interrupt)
      this.writeEmitter.fire('^C\r\n');
      this.currentLine = '';
      this.cursorIndex = 0;
      this.multiLineBuffer = [];
      this.showPrompt();
    } else if (data === '\x04') {
      // Ctrl+D (EOF / Exit)
      this.writeEmitter.fire('\r\nExiting TouchDesigner REPL.\r\n');
      this.close();
    } else if (data === '\x0c') {
      // Ctrl+L (Clear screen)
      this.writeEmitter.fire('\x1b[2J\x1b[3J\x1b[H');
      this.showPrompt();
      this.writeEmitter.fire(this.currentLine);
    } else if (data === '\x1b[A') {
      // Up Arrow (History prev)
      this.navigateHistory(-1);
    } else if (data === '\x1b[B') {
      // Down Arrow (History next)
      this.navigateHistory(1);
    } else if (data === '\x1b[D') {
      // Left Arrow
      if (this.cursorIndex > 0) {
        this.cursorIndex--;
        this.writeEmitter.fire('\x1b[D');
      }
    } else if (data === '\x1b[C') {
      // Right Arrow
      if (this.cursorIndex < this.currentLine.length) {
        this.cursorIndex++;
        this.writeEmitter.fire('\x1b[C');
      }
    } else if (data === '\t') {
      // Tab key -> 4 spaces
      this.insertText('    ');
    } else if (data.length === 1 && data >= ' ') {
      // Printable character
      this.insertText(data);
    } else if (data.length > 1 && !data.startsWith('\x1b')) {
      // Pasted multi-character string
      this.insertText(data.replace(/\r?\n/g, ' '));
    }
  }

  private insertText(text: string) {
    const left = this.currentLine.substring(0, this.cursorIndex);
    const right = this.currentLine.substring(this.cursorIndex);
    this.currentLine = left + text + right;
    this.cursorIndex += text.length;

    // Refresh display
    this.writeEmitter.fire(text + right);
    // Move cursor back to proper position if inserted in middle
    if (right.length > 0) {
      this.writeEmitter.fire(`\x1b[${right.length}D`);
    }
  }

  private handleBackspace() {
    if (this.cursorIndex > 0) {
      const left = this.currentLine.substring(0, this.cursorIndex - 1);
      const right = this.currentLine.substring(this.cursorIndex);
      this.currentLine = left + right;
      this.cursorIndex--;

      this.writeEmitter.fire('\b' + right + ' ' + `\x1b[${right.length + 1}D`);
    }
  }

  private async handleEnter() {
    this.writeEmitter.fire('\r\n');
    const trimmed = this.currentLine.trim();

    // Built-in commands
    if (trimmed === 'exit' || trimmed === 'quit') {
      this.writeEmitter.fire('Exiting TouchDesigner REPL.\r\n');
      this.close();
      return;
    }

    if (trimmed === 'clear') {
      this.writeEmitter.fire('\x1b[2J\x1b[3J\x1b[H');
      this.currentLine = '';
      this.cursorIndex = 0;
      this.showPrompt();
      return;
    }

    // Check for multi-line block
    if (this.multiLineBuffer.length > 0) {
      if (this.currentLine.trim() === '') {
        // Empty line finishes multi-line entry
        const fullCode = this.multiLineBuffer.join('\n');
        this.multiLineBuffer = [];
        await this.executeCode(fullCode);
      } else {
        this.multiLineBuffer.push(this.currentLine);
        this.currentLine = '';
        this.cursorIndex = 0;
        this.showPrompt();
        return;
      }
    } else if (this.currentLine.trimEnd().endsWith(':')) {
      // Start of multi-line block (e.g. def func(): or if True:)
      this.multiLineBuffer.push(this.currentLine);
      this.currentLine = '';
      this.cursorIndex = 0;
      this.showPrompt();
      return;
    } else if (this.currentLine.trim() !== '') {
      // Single line execution
      const code = this.currentLine;
      this.recordHistory(code);
      this.currentLine = '';
      this.cursorIndex = 0;
      await this.executeCode(code);
    }

    this.currentLine = '';
    this.cursorIndex = 0;
    this.historyIndex = -1;
    this.showPrompt();
  }

  private async executeCode(code: string) {
    if (!tdClient.isConnected) {
      this.writeEmitter.fire(
        '\x1b[31;1mError: TouchDesigner is not connected. Use Cmd+Shift+P -> "Connect to TouchDesigner"\x1b[0m\r\n'
      );
      return;
    }

    try {
      const startTime = Date.now();
      const res = await tdClient.evalCode(code);
      const elapsed = Date.now() - startTime;

      // Print STDOUT
      if (res.stdout && res.stdout.trim().length > 0) {
        const lines = res.stdout.trimEnd().split('\n');
        for (const line of lines) {
          this.writeEmitter.fire(`${line}\r\n`);
        }
      }

      // Print STDERR
      if (res.stderr && res.stderr.trim().length > 0) {
        const lines = res.stderr.trimEnd().split('\n');
        for (const line of lines) {
          this.writeEmitter.fire(`\x1b[31m${line}\x1b[0m\r\n`);
        }
      }

      // Print Result
      if (res.success) {
        if (res.result !== undefined && res.result !== null && res.result !== '') {
          const valStr = typeof res.result === 'object' ? JSON.stringify(res.result) : String(res.result);
          this.writeEmitter.fire(`\x1b[36;1m${valStr}\x1b[0m \x1b[90m(${elapsed}ms)\x1b[0m\r\n`);
        }
      } else {
        this.writeEmitter.fire(`\x1b[31;1mError:\x1b[0m \x1b[31m${res.error || 'Execution failed'}\x1b[0m\r\n`);
      }
    } catch (err: any) {
      this.writeEmitter.fire(`\x1b[31;1mException:\x1b[0m \x1b[31m${err.message}\x1b[0m\r\n`);
    }
  }

  private showPrompt() {
    const prompt = this.multiLineBuffer.length > 0 ? this.PROMPT_MULTI : this.PROMPT_NORMAL;
    this.writeEmitter.fire(prompt);
  }

  private recordHistory(cmd: string) {
    if (!cmd.trim()) {
      return;
    }
    if (this.history.length === 0 || this.history[this.history.length - 1] !== cmd) {
      this.history.push(cmd);
    }
  }

  private navigateHistory(direction: number) {
    if (this.history.length === 0) {
      return;
    }

    if (direction < 0) {
      // Up arrow
      if (this.historyIndex === -1) {
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
    } else {
      // Down arrow
      if (this.historyIndex !== -1) {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
        } else {
          this.historyIndex = -1;
        }
      }
    }

    // Clear current line on screen
    if (this.currentLine.length > 0) {
      this.writeEmitter.fire(`\x1b[${this.cursorIndex}D\x1b[K`);
    }

    // Set new line
    this.currentLine = this.historyIndex !== -1 ? this.history[this.historyIndex] : '';
    this.cursorIndex = this.currentLine.length;
    this.writeEmitter.fire(this.currentLine);
  }
}

export class ReplTerminalManager {
  private static terminal: vscode.Terminal | null = null;

  public static openRepl() {
    if (ReplTerminalManager.terminal) {
      ReplTerminalManager.terminal.show();
      return;
    }

    const pty = new TouchDesignerREPL();
    pty.onDidClose(() => {
      ReplTerminalManager.terminal = null;
    });

    ReplTerminalManager.terminal = vscode.window.createTerminal({
      name: 'TouchDesigner REPL',
      pty,
      iconPath: new vscode.ThemeIcon('terminal'),
    });

    ReplTerminalManager.terminal.show();
  }
}

