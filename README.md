# Unicode Proxy

> [!IMPORTANT]
> This repository has been archived since we have moved to be inside the [ucdjs/ucd](https://github.com/ucdjs/ucd) repository.
>
> This is done to iterate faster, so for tracking the newest progress, take a look at [ucdjs/ucd#proxy](<[https://github.com/ucdjs/ucd](https://github.com/ucdjs/ucd/tree/main/apps/proxy)>)

A proxy that sits between you and your Unicode data files.

## Usage

Unicode Proxy is a lightweight intermediary between your requests and the [Unicode website](https://unicode.org). Depending on the endpoint you hit, you'll either receive a JSON-formatted directory listing or the raw content of a file.

> [!NOTE]
> By default, the proxy caches responses for 1 hour.

### Get a Directory Listing

Fetch a JSON listing of files from a directory:

```bash
curl https://unicode-proxy.ucdjs.dev
```

### Get a File

Retrieve the raw contents of a specific file:

```bash
curl https://unicode-proxy.ucdjs.dev/path/to/file
```

> [!NOTE]
> If the requested path is a directory, a JSON listing is provided. Otherwise, you'll receive the raw file contents.
