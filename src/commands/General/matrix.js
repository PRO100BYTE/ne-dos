export default class MatrixCommand {
    execute(term, params, directory, setDirectory) {
      var canvas = document.createElement("canvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.zIndex = "1";
      term.element.appendChild(canvas);
      term.writeln("Entering in The Matrix...")

      var ctx = canvas.getContext("2d");
      var symbols = "01";
      var fontSize = 14;
      var columns = canvas.width / fontSize;
      var drops = [];

      for (var i = 0; i < columns; i++) {
        drops[i] = Math.floor(Math.random() * canvas.height);
      }

      function draw() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = fontSize + "px monospace";
        ctx.fillStyle = "#0F0";

        for (var i = 0; i < columns; i++) {
          var symbol = symbols[Math.floor(Math.random() * symbols.length)];

          ctx.fillText(symbol, i * fontSize, drops[i] * fontSize);

          if (Math.random() > 0.99) {
            drops[i] = 0;
          } else {
            drops[i]++;
          }
        }

        requestAnimationFrame(draw);
      }
      draw();

      if (!params[1] || params[1].toLowerCase() !== "/infinity") {
        setTimeout(function() {
          function fadeOut() {
            canvas.style.opacity -= 0.01;
            if (canvas.style.opacity > 0) {
              setTimeout(fadeOut, 20);
            } else {
              term.element.removeChild(canvas);
            }
          }
          fadeOut();
        }, 5000);
      }
    }
  
    description() {
      return "Displays an animation of a binary rain from The Matrix";
    }
  
    help(term) {
      term.writeln("The matrix command displays an animation of a binary rain from The Matrix on a canvas over the console for 5 seconds.");
      term.writeln("The canvas fades out smoothly after the animation.");
      term.writeln("To stop the animation earlier, you need to close and reopen the terminal.");
    }
  }
  