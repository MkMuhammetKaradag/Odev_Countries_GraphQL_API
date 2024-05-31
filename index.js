import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { countries, continents, languages } from "./data.js";
import { createServer } from "node:http";
import { createSchema, createYoga,} from "graphql-yoga";
import pubSub from "./pubsub.js";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

const typeDefs = /* GraphQL */ `
  type Country {
    code: String!
    name: String!
    capital: String
    continent_code: String!
    languages_code: String!
    continent: Continent!
    languages: [Language]!
  }

  type Continent {
    code: String!
    name: String!
    countries: [Country]!
  }
  type Language {
    code: ID!
    name: String!
    native: String!
    rtl: Boolean!
  }

  type Query {
    countries: [Country!]
    country(code: String!): Country

    continents: [Continent!]
    continent(code: String!): Continent

    language(code: String!): Language
    languages: [Language!]
  }
`;
const resolvers = {
  Query: {
    countries: async (_, __, context) => {
      const countries = context.db.countries;
      return countries;
    },
    country: async (parent, args, context) => {
      const country = context.db.countries.find((e) => e.code === args.code);

      if (!country) {
        throw "country not found";
      }

      return country;
    },

    continents: async (_, __, context) => {
      const continents = context.db.continents;
      return continents;
    },
    continent: async (parent, args, context) => {
      const continent = context.db.continents.find((e) => e.code === args.code);

      if (!continent) {
        throw "continent not found";
      }

      return continent;
    },

    languages: async (_, __, context) => {
      const languages = context.db.languages;
      return languages;
    },
    language: async (parent, args, context) => {
      const language = context.db.languages.find((e) => e.code === args.code);

      if (!language) {
        throw "language not found";
      }

      return language;
    },
  },

  Country: {
    continent: async (parent, args, context) => {
      const data = context.db.continents.find(
        (e) => e.code === parent.continent_code
      );

      return data;
    },
    languages: async (parent, args, context) => {
      const data = context.db.languages.filter(
        (e) => e.code === parent.languages_code
      );

      return data;
    },
  },
  Continent: {
    countries: async (parent, args, context) => {
      const data = context.db.countries.filter(
        (e) => e.continent_code === parent.code
      );

      return data;
    },
  },
};

const yogaApp = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  context: { pubSub, db: { countries, continents, languages } },
  plugins: [ApolloServerPluginLandingPageGraphQLPlayground({})], // not working
  graphiql: {
    subscriptionsProtocol: "WS",
  },
});

const httpServer = createServer(yogaApp);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: yogaApp.graphqlEndpoint,
});

useServer(
  {
    execute: (args) => args.rootValue.execute(args),
    subscribe: (args) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, msg) => {
      const { schema, execute, subscribe, contextFactory, parse, validate } =
        yogaApp.getEnveloped({
          ...ctx,
          req: ctx.extra.request,
          socket: ctx.extra.socket,
          params: msg.payload,
        });

      const args = {
        schema,
        operationName: msg.payload.operationName,
        document: parse(msg.payload.query),
        variableValues: msg.payload.variables,
        contextValue: await contextFactory(),
        rootValue: {
          execute,
          subscribe,
        },
      };

      const errors = validate(args.schema, args.document);
      if (errors.length) return errors;
      return args;
    },
  },
  wsServer
);
httpServer.listen(4000, () => {
  console.log("Server is running on port 4000");
});
