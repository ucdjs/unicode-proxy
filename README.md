# Unicode Proxy

A proxy that sits between you and your favourite mojis!

## Usage

Unicode Proxy is a lightweight intermediary between your requests and the [Unicode website](https://unicode.org). Depending on the endpoint you hit, you'll either receive a JSON-formatted directory listing or the raw content of a file.

### Get a Directory Listing

Fetch a JSON listing of files from a directory:

```bash
curl https://unicode-proxy.mojis.dev/proxy
```

### Get a File

Retrieve the raw contents of a specific file:

```bash
curl https://unicode-proxy.mojis.dev/proxy/path/to/file
```

> [!NOTE]
> If the requested path is a directory, a JSON listing is provided. Otherwise, you'll receive the raw file contents.
