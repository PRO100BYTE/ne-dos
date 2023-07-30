import JSConfetti from 'js-confetti'

export default class ExitCommand {
    execute(term, params, directory, setDirectory) {
            if (params[1] === "/confetti") {
                const jsConfetti = new JSConfetti() 
                jsConfetti.addConfetti({ emojis: ['🖥', '💻'], emojiSize: 50, confettiNumber: 100, })
                term.writeln(''); 
                term.writeln('The NE-DOS session will be terminated in 5 seconds. Bye-Bye!');
                setTimeout(() => {
                    window.close();
                }, 5000);
               return;
           } 
           term.writeln('');
           term.writeln('The NE-DOS session will be terminated in 5 seconds. Bye-Bye!');

         setTimeout(() => {
           window.close();
         }, 5000);
       }
    }       