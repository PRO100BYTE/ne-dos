export default class PromptCommand {
  description() { return "Change command prompt format"; }

  help(term) {
    term.writeln('Usage: prompt [text]');
    term.writeln('Special tokens: $P $G $T $L $B $S');
    term.writeln('Example: prompt $P$G');
  }

  execute(term, params) {
    const value = params.slice(1).join(' ');
    if (!value) {
      window.__nedosPromptTemplate = '$P$G';
      term.writeln('Prompt reset to default.');
      return;
    }
    window.__nedosPromptTemplate = value;
  }
}
