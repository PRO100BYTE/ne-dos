export default class MemCommand {
  description() { return "Display memory usage summary"; }

  help(term) {
    term.writeln('Usage: mem');
  }

  execute(term) {
    const perf = window.performance && window.performance.memory ? window.performance.memory : null;
    term.writeln('Conventional Memory : 640K');
    term.writeln('Upper Memory        : 384K');
    if (perf) {
      const toKb = (v) => Math.round(v / 1024);
      term.writeln(`JS Heap Used        : ${toKb(perf.usedJSHeapSize)}K`);
      term.writeln(`JS Heap Total       : ${toKb(perf.totalJSHeapSize)}K`);
      term.writeln(`JS Heap Limit       : ${toKb(perf.jsHeapSizeLimit)}K`);
    } else {
      term.writeln('JS Heap info unavailable in this browser.');
    }
  }
}
