export default class CatCommand {
    execute(term, params, directory, setDirectory) {
      let statuses = [100, 101, 102, 200, 201, 202, 204, 206, 207, 300, 301, 302, 303, 304, 305, 307, 400, 401, 402, 403, 404, 405, 406, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 422, 423, 424, 425, 426, 428, 429, 431, 444, 450, 451, 497, 498, 499, 500, 501, 502, 503, 504, 506, 507, 508, 509, 510, 511, 521, 522, 523, 525, 530, 599]
      let status = statuses[Math.floor(Math.random() * statuses.length)];
      let url = "https://http.cat/" + status;
      window.open(url);
      term.writeln("Opening a new tab with a cat image for HTTP status " + status);
    }
}