# hello-http

A tiny zero-dependency HTTP server for local development and testing.

## Quick start

```bash
npm start        # start the server on port 8080
npm run dev      # same, with hot-reload friendly output
npm test         # run the test suite
```

## Configuration

| Variable | Default | Description       |
|----------|---------|-------------------|
| `PORT`   | `8080`  | Port to listen on |

## Endpoints

`GET /*` — returns a JSON health-check object:

```json
{
  "status": "ok",
  "message": "Hello, World!",
  "path": "/",
  "timestamp": "2026-06-16T00:00:00.000Z"
}
```

## License

MIT
