export default class WeatherCommand {
    // make the function async
    async execute(term, params, directory, setDirectory) {
      let city = params.join(" ");
      let url = `https://wttr.in/${city}?format=j1`;
  
      // use try...catch to handle errors
      try {
        // use await to get the response
        let response = await fetch(url);
  
        // check if the response is ok
        if (response.ok) {
          // use await to get the JSON data
          let data = await response.json();
  
          // use await to create a delay of 1 second
          await new Promise((a) => setTimeout(a, 1000));
  
          // print the weather data
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
        } else {
          // throw an error if the response is not ok
          throw new Error("HTTP error " + response.status);
        }
      } catch (error) {
        // print the error message
        term.writeln("weather: failed to get weather data");
      }
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
  