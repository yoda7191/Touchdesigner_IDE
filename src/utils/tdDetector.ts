import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TDEnvironmentPaths {
  pythonPath: string;
  sitePackagesPath?: string;
  tdiStubPath?: string;
  versionName: string;
}

export class TouchDesignerDetector {
  /**
   * Scans system for TouchDesigner installations and locates Python binary and TDI stubs
   */
  public static detectEnvironment(): TDEnvironmentPaths | null {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this.detectMac();
    } else if (platform === 'win32') {
      return this.detectWindows();
    }

    return null;
  }

  private static detectMac(): TDEnvironmentPaths | null {
    const baseAppPath = '/Applications/TouchDesigner.app';
    if (!fs.existsSync(baseAppPath)) {
      return null;
    }

    const frameworksPath = path.join(baseAppPath, 'Contents', 'Frameworks', 'Python.framework', 'Versions');
    if (!fs.existsSync(frameworksPath)) {
      return null;
    }

    // Check version folders, e.g. 3.11, 3.10, 3.9
    const versions = ['3.11', '3.10', '3.9'];
    for (const ver of versions) {
      const verPath = path.join(frameworksPath, ver);
      const pythonBin = path.join(verPath, 'bin', `python${ver}`);
      const sitePackages = path.join(verPath, 'lib', `python${ver}`, 'site-packages');
      const tdiPath = path.join(sitePackages, 'tdi');

      if (fs.existsSync(pythonBin)) {
        return {
          pythonPath: pythonBin,
          sitePackagesPath: fs.existsSync(sitePackages) ? sitePackages : undefined,
          tdiStubPath: fs.existsSync(tdiPath) ? tdiPath : undefined,
          versionName: `TouchDesigner macOS (Python ${ver})`,
        };
      }
    }

    return null;
  }

  private static detectWindows(): TDEnvironmentPaths | null {
    const commonDirs = [
      'C:\\Program Files\\Derivative\\TouchDesigner\\bin',
      'C:\\Program Files\\Derivative\\TouchDesigner099\\bin',
    ];

    for (const binDir of commonDirs) {
      const pythonBin = path.join(binDir, 'python.exe');
      const sitePackages = path.join(binDir, 'Lib', 'site-packages');
      const tdiPath = path.join(sitePackages, 'tdi');

      if (fs.existsSync(pythonBin)) {
        return {
          pythonPath: pythonBin,
          sitePackagesPath: fs.existsSync(sitePackages) ? sitePackages : undefined,
          tdiStubPath: fs.existsSync(tdiPath) ? tdiPath : undefined,
          versionName: 'TouchDesigner Windows',
        };
      }
    }

    return null;
  }
}
