export default class GeoCommand {
    async execute(term, params, directory, setDirectory) {
        await new Promise((a) => {
            if (!navigator.geolocation) {
                term.writeln("Geolocation is not available");
                a();
                return;
            }

            try {
                navigator.geolocation.getCurrentPosition(pos => {
                    const { latitude, longitude } = pos.coords;
                    const link = `https://www.openstreetmap.org/search?query=${latitude}%2C${longitude}`;
                    term.writeln(`Latitude: ${latitude}`)
                    term.writeln(`Longitude: ${longitude}`)
                    term.writeln(`Link: ${link}`)
                    a();
                });
            } catch (err) {
                console.error(err);
                term.writeln(err.message);
                a();
            }
        });
    }
}