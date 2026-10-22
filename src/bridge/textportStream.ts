import * as vscode from 'vscode';
import { tdClient } from './tdClient';
import { TextportEvent } from './protocol';

export class TextportStream {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('TouchDesigner Textport');

    // Subscribe to TD client textport events
    tdClient.on('textport', (event: TextportEvent) => {
      this.handleTextportEvent(event);
    });

    tdClient.on('connected', (info) => {
      const time = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(
        `[${time}] [SYSTEM] Connected to TouchDesigner ${info?.tdVersion || ''} (build ${info?.tdBuild || ''}) - Project: ${info?.projectName || 'unknown'}`
      );
    });

    tdClient.on('disconnected', (reason) => {
      const time = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`[${time}] [SYSTEM] Disconnected from TouchDesigner (${reason})`);
    });
  }

  public show(preserveFocus: boolean = true) {
    this.outputChannel.show(preserveFocus);
  }

  public clear() {
    this.outputChannel.clear();
  }

  public log(message: string, prefix = 'INFO') {
    const time = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${time}] [${prefix}] ${message}`);
  }

  public logEvalResult(
    code: string,
    success: boolean,
    result: any,
    stdout?: string,
    stderr?: string,
    timeMs?: number
  ) {
    const time = new Date().toLocaleTimeString();
    const config = vscode.workspace.getConfiguration('touchdesigner');
    const autoShow = config.get<boolean>('showTextportOnOutput', true);

    const timingStr = timeMs !== undefined ? ` (${timeMs.toFixed(1)}ms)` : '';

    if (stdout && stdout.trim().length > 0) {
      this.outputChannel.appendLine(`[${time}] [TD STDOUT]:\n${stdout.trimEnd()}`);
    }

    if (stderr && stderr.trim().length > 0) {
      this.outputChannel.appendLine(`[${time}] [TD STDERR]:\n${stderr.trimEnd()}`);
      if (autoShow) {
        this.show(true);
      }
    }

    if (success) {
      if (result !== undefined && result !== null && result !== '') {
        const resStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        this.outputChannel.appendLine(`[${time}] [RESULT${timingStr}] => ${resStr}`);
      } else if (!stdout && !stderr) {
        this.outputChannel.appendLine(`[${time}] [EXECUTED${timingStr}] Done.`);
      }
    } else {
      this.outputChannel.appendLine(`[${time}] [ERROR${timingStr}] ${result || 'Execution failed'}`);
      if (autoShow) {
        this.show(true);
      }
    }
  }

  private handleTextportEvent(event: TextportEvent) {
    const time = new Date(event.timestamp || Date.now()).toLocaleTimeString();
    const tag = event.stream === 'stderr' ? 'TD STDERR' : 'TD STDOUT';
    this.outputChannel.appendLine(`[${time}] [${tag}] ${event.message.trimEnd()}`);

    if (event.stream === 'stderr') {
      const config = vscode.workspace.getConfiguration('touchdesigner');
      if (config.get<boolean>('showTextportOnOutput', true)) {
        this.show(true);
      }
    }
  }

  public dispose() {
    this.outputChannel.dispose();
  }
}

export const textport = new TextportStream();
