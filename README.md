# Relay World

An interactive miniature city that visualizes crosschain journeys with Three.js.

## Project status

Relay World is a discontinued community project. Relay's API is changing, and public read-only access is no longer available in a sustainable way. Continuing live activity would require hosting a server to provide an API key, so development has ended.

The [website](https://warengonzaga.github.io/relay-world/) remains available as an illustrative demo. It uses sample data only and does not connect to Relay's API.

See Relay's [Requests v3 migration guide](https://docs.relay.link/references/api/api_guides/migrating-to-requests-v3) for details about the API changes.

## Run locally

Requires Node.js 22.16 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173 to explore the demo city. The scenario menu lets you preview sample transfers, checkpoints, failures, queues, and flights. No live Relay data is loaded.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
