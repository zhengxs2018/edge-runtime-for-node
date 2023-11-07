# Edge Runtime for Node

使用 Node.js 最新的 API 模拟 Edge Runtime。

## 启用项目

目前只支持 `Node.js >= >=18.14.0`，低于此版本的无法启动项目。

```sh
$ yarn install

$ yarn dev
```

## 示例代码

模拟 [Deno.serve()](https://docs.deno.com/runtime/tutorials/http_server) API

```ts
import EdgeRuntime from "./edge-runtime";

const runtime = new EdgeRuntime();

const port = 8080;

const handler = (request: Request): Response=> {
  const body = `Your user-agent is:\n\n${
    request.headers.get("user-agent") ?? "Unknown"
  }`;

  return new Response(body, { status: 200 });
};

console.log(`HTTP server running. Access it at: http://localhost:8080/`);
runtime.serve({ port }, handler)
```

## 参考

- [Vercel: Edge Runtime Node Utils](https://edge-runtime.vercel.app/packages/node-utils)

## License

MIT
