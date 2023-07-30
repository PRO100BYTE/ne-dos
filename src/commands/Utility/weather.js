export default class WeatherCommand {
    async execute(term, params, directory, setDirectory) {
      if (params.length === 0) {
        term.writeln("weather: takes the name of a city as an argument and prints the current weather in it.");
        term.writeln("Example: weather Moscow");
        return;
      }

      let city = params.join(" ");
      let url = `https://wttr.in/${city}?format=j1`;

      fetch(url)
        .then(response => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error("HTTP error " + response.status);
          }
        })
        .then(data => {
          term.writeln("");
          term.writeln(`Temperature: ${data.current_condition[0].temp_C} °C`);
          term.writeln(`Feels like: ${data.current_condition[0].FeelsLikeC} °C`);
          term.writeln(`Humidity: ${data.current_condition[0].humidity} %`);
          term.writeln(`Pressure: ${data.current_condition[0].pressure} mmHg`);
          term.writeln(`Wind speed: ${data.current_condition[0].windspeedKmph} km/h`);
          term.writeln(`Wind direction: ${data.current_condition[0].winddir16Point}`);
          term.writeln(`Cloud cover: ${data.current_condition[0].cloudcover} %`);
          term.writeln(`Precipitation: ${data.current_condition[0].precipMM} mm`);
          term.writeln(`Visibility: ${data.current_condition[0].visibility} km`);
          term.writeln(`Weather conditions: ${data.current_condition[0].weatherDesc[0].value}`);
        })
        .catch(error => {
          term.writeln("Error: Failed to get weather data");
        });
    }
    
    description() {
      return "Prints the current weather in the specified city";
    }
    
    help(term) {
      term.writeln("Usage: weather [city]");
      term.writeln("Takes the name of a city as an argument and prints the current weather in it.");
      term.writeln("Example: weather Moscow");
    }
  }
  