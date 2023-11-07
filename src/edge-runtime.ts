import {
  type IncomingHttpHeaders,
  type IncomingMessage,
  Server,
  type ServerResponse,
  createServer,
} from "node:http";
import { type ListenOptions } from "node:net";
import { once } from "node:events";
import { Readable, finished } from "node:stream";
import { ReadableStream as WebReadableStream } from "node:stream/web";

export type MaybePromise<T> = Promise<T> | T;

export class EdgeRuntime {
  constructor(protected defaultOrigin = "https://localhost") {}

  async serve(options: ListenOptions, handler: WebHandler): Promise<Server> {
    const server = createServer(this.toRequestListener(handler));

    server.listen(options);

    await once(server, "listening");

    return server;
  }

  protected toRequestListener(handler: WebHandler): RequestListener {
    return async (req, res) => {
      const request = this.toWebRequest(req);

      const end = () => {
        // Response already sent
        if (res.headersSent && !res.writable) return

        res.end();
      }

      const respondWith = async (
        responseInit?: MaybePromise<Response | null | undefined>,
      ) => {
        const response = await responseInit;
        if (!response) return end();

        res.statusCode = response.status;
        res.statusMessage = response.statusText;

        EdgeRuntime.mergeIntoServerResponse(response.headers, res);

        const body = response.body;
        if (!body) return end();

        // See https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1402
        Readable.fromWeb(body as WebReadableStream).pipe(res);
      };

      finished(res, err => {
        if (!err) return

        const msg = err.stack || err.toString()
        console.error(`\n${msg.replace(/^/gm, '  ')}\n`)
      })

      return respondWith(handler(request));
    };
  }

  protected toWebURL({ url = "/", headers }: IncomingMessage) {
    const authority = headers.host;
    if (!authority) return new URL(url, this.defaultOrigin);

    const [, port] = authority.split(":");
    return new URL(url, `${port === "443" ? "https" : "http"}://${authority}`);
  }

  protected toWebRequest(req: IncomingMessage) {
    return new Request(this.toWebURL(req), {
      method: req.method,
      headers: EdgeRuntime.toWebHeaders(req.headers),
      body: EdgeRuntime.toWebReadableStream(req),
    });
  }

  static toWebHeaders(httpHeaders: IncomingHttpHeaders) {
    const headers = new Headers();

    for (const [name, value] of Object.entries(httpHeaders)) {
      if (value == null) continue;

      if (Array.isArray(value)) {
        value.forEach((item) => headers.append(name, item));
      } else {
        headers.set(name, value);
      }
    }

    return headers;
  }

  static mergeIntoServerResponse(
    headers: Headers,
    serverResponse: ServerResponse,
  ) {
    for (const [name, value] of headers) {
      if (name === "set-cookie") {
        serverResponse.setHeader(name, headers.getSetCookie());
      } else {
        serverResponse.setHeader(name, value);
      }
    }
  }

  static toWebReadableStream(req: IncomingMessage): BodyInit | null {
    if (req.method === "GET" || req.method === "HEAD") return null;
    return Readable.toWeb(req) as globalThis.ReadableStream;
  }
}

export type RequestListener = EdgeRuntime.RequestListener;

export type WebHandler = EdgeRuntime.WebHandler;

export namespace EdgeRuntime {
  export type WebHandler = (
    req: Request,
  ) => MaybePromise<Response | null | undefined>;

  export type RequestListener = (
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage> & {
      req: IncomingMessage;
    },
  ) => void;
}

export default EdgeRuntime;
