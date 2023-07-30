import bytes from "bytes";

export default class StatusCommand {
  async execute(term, params, directory, setDirectory) {
    if (navigator.getBattery) {
      const batt = await navigator.getBattery();
      term.writeln(`Battery:\t${batt.level * 100}% (${batt.charging ? "charging" : "autonomous"})`);
    }

    if (navigator.storage?.estimate) {
      const storageDetails = await navigator.storage.estimate();
      const used = bytes(storageDetails.usage);
      const free = bytes(storageDetails.quota - storageDetails.usage);
      term.writeln(`Storage:`);
      term.writeln(`  Used: ${used}`);
      term.writeln(`  Free: ${free}`);
    }

    if (console.memory) {
      term.writeln(`Heap Limit:\t${bytes(console.memory.jsHeapSizeLimit)}`);
    }
    if (navigator.hardwareConcurrency) {
      term.writeln(`Cores:\t\t${navigator.hardwareConcurrency}`);
    }
    if (typeof navigator.onLine === 'boolean') {
      term.writeln(`Online:\t\t${navigator.onLine ? "Yes" : "No"}`);
    }
    if (navigator.connection) {
      term.writeln(`Downlink:\t~${navigator.connection.downlink} Mbps`)
    }
  }

  description() {
    return "Current system status";
  }
}