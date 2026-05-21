export default class RebootCommand {
    async execute(term, params, directory, setDirectory) {
      const mode = (params[1] || '').toLowerCase();
      const soft = mode === 'soft';
      term.writeln(`NE-DOS will be ${soft ? 'soft-' : ''}rebooted in 3 seconds...`);
      await new Promise((a) => setTimeout(a, 3000));
      if (soft) {
        if (typeof window.__nedosSoftRebootSystem === 'function') {
          window.__nedosSoftRebootSystem();
        } else {
          window.location.reload();
        }
      } else {
        if (typeof window.__nedosHardRebootSystem === 'function') {
          window.__nedosHardRebootSystem();
        } else {
          window.location.reload();
        }
      }
    }
    
    description() {
      return "Reboots NE-DOS (hard by default, soft with parameter)";
    }
    
    help(term) {
      term.writeln("Usage: reboot [soft]");
      term.writeln("reboot       Hard reboot (full page reload).");
      term.writeln("reboot soft  Soft reboot (reinitialize components in-app).");
      term.writeln("Both modes run after a 3-second countdown.");
    }
  }
  