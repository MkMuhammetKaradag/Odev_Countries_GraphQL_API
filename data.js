import { readFileSync } from "fs";
// import test from "./test.json";

const data = readFileSync("./odev_countries/data.json");

const { countries, continents, languages } = JSON.parse(data);

export { countries, continents, languages };
