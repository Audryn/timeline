import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export function stopOwnedTree(child) {
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return;
  }
  // Snapshot descendants before terminating the root: Windows does not forward SIGTERM.
  const command = `
    $all = @(Get-CimInstance Win32_Process)
    $ids = [System.Collections.Generic.List[int]]::new()
    $ids.Add(${child.pid})
    for ($i = 0; $i -lt $ids.Count; $i++) {
      foreach ($p in $all) {
        if ($p.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$p.ProcessId)) {
          $ids.Add([int]$p.ProcessId)
        }
      }
    }
    $ids.Reverse()
    foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  `;
  execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], (error) => {
    if (error) {
      console.error("Could not stop the owned test process tree. Inspect its recorded PID; do not kill processes by name.");
      process.exitCode = 1;
    }
  });
}

export function runNode(args, env, { cwd = projectRoot } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: "inherit" });
    let stopping = false;
    const stop = () => {
      if (!stopping) {
        stopping = true;
        stopOwnedTree(child);
      }
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    const cleanup = () => {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    };
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(signal ? `Owned test process stopped (${signal}).` : `Test command failed (${code}).`));
    });
  });
}
