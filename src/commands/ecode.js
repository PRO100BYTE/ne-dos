export default class ECodeAPICommand {
    async execute(term, params, directory, setDirectory) {
        const cmd = params[1];
        switch (cmd) {
            default:
                term.writeln("");
                term.writeln("  Usage:");
                term.writeln("    ecode auth [token]          Login into ecode using API key");
                term.writeln("    ecode account               Your account info");
                term.writeln("    ecode logout                Remove credentials from account");
                break
            case 'auth':
                const token = params[2];
                if (!token || token === "") {
                    term.writeln("Usage: ecode auth [token]")
                    return;
                }

                this.login(term, token);
                break
            case 'account':
                await this.fetchAccount(term);
                break
            case 'logout':
                this.logout()
                term.writeln("Signed out");
                break
        }
    }

    login(term, token) {
        if (!window.fs.existsSync("/.config")) {
            window.fs.mkdirSync("/.config");
        }
        if (!window.fs.statSync("/.config").isDirectory()) {
            term.writeln("  \x1b[31;1m!!! WARNING !!!\x1b[0m");
            term.writeln("  C:\\.config IS NOT A DIRECTORY!");
            term.writeln("  CAN'T CREATE CONFIGURATION FILE!");
            return;
        }

        if (window.fs.existsSync("/.config/ecode.token")) {
            if (window.fs.statSync("/.config/ecode.token").isDirectory()) {
                term.writeln("  \x1b[31;1m!!! WARNING !!!\x1b[0m");
                term.writeln("  C:\\.config\\ecode.token IS A DIRECTORY!");
                term.writeln("  CAN'T CREATE CONFIGURATION FILE!");
                return;
            }

            term.writeln("  \x1b[31;1mYou are already logged in!\x1b[0m");
            term.writeln("  Please log out first using 'ecode logout'");
            return;
        }

        window.fs.writeFileSync("/.config/ecode.token", token);

        term.writeln(`Signed in with token ${token}`);
    }
    logout() {
        if (!window.fs.existsSync("/.config")) {
            return;
        }

        if (!window.fs.existsSync("/.config/ecode.token")) {
            return;
        }

        window.fs.unlinkSync("/.config/ecode.token");
    }
    async fetchAccount(term) {
        if (!window.fs.existsSync("/.config/ecode.token")) {
            term.writeln("  \x1b[33;1mNo API key found\x1b[0m");
            term.writeln("  Please sign in first: ecode auth [token]");
            return;
        }

        const token = window.fs.readFileSync("/.config/ecode.token", "utf8");
        const d = await fetch(`https://api2.edwardcode.ru/method/auth/get_user?access_token=${token}`)
          .then(d => d.json());

        if (d.user_id) {
            term.writeln("");
            term.writeln("  You signed in into ECode APIs using account:");
            term.writeln(`    Account ID: ${d.user_id}`);
        } else {
            term.writeln("");
            term.writeln("  \x1b[33;1mFailed to get user information.\x1b[0m");
            term.writeln("  You can log out and try to sign in again.");
            term.writeln("  ");
            term.writeln("  Possible reasons for this error are:");
            term.writeln("  - Invalid API key");
            term.writeln("  - You reached your API requests daily limit");
        }
    }
  }