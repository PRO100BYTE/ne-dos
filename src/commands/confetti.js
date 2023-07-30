import JSConfetti from "js-confetti";

export default class ConfettiCommand {
    execute(term, params, directory, setDirectory) {
        const jsConfetti = new JSConfetti();
        jsConfetti.addConfetti({
            emojis: ['🌈', '⚡️', '💥', '✨', '💫', '🌸'],
        });
    }
  }